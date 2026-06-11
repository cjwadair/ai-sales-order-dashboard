# IR Reporting Engine

The reporting engine answers natural-language questions ("YTD sales by rep, top 5") by having
Claude emit a structured **query spec (IR)** — never SQL — which a deterministic backend pipeline
validates, compiles into a parameterized ActiveRecord/Arel query, executes, and returns as a
typed JSON envelope. This document describes the system **as built** through Phase 1.9
(June 2026); design history lives in the per-phase commits referenced at the end.

## Design intent: multiple data sources is the destination

The engine hosts several independent datasets ("scopes" — today `sales` and `inventory`), each
described by its own semantic config and queried through the **same** IR pipeline. All engine
work assumes multi-source:

- The per-request domain selector (`scope`) is a first-class, always-present input — never
  hardcode or assume `"sales"` downstream of the controller.
- All per-scope state (config loading, tool-schema generation, caching) is keyed by scope, not
  global.
- Adding a dataset is **config + curation, not a refactor** (see the playbook below).

**Terminology:** `scope` is the request-level *domain* selector (`sales`, `inventory`). The IR's
`source` field is something else — the *root entity* within a scope (`order`, `inventory`).

### Envelope vs. grain

Selecting *what is queryable* is not selecting *grain*. The scope only bounds **which config is
in play** (the envelope); within it, grain (order vs. order_item) is the compiler's per-query
join decision, driven by the curated relationship graph. Different endpoints serve different
surfaces by setting different envelope widths: Chat is widest (scope resolved per request); a
focused endpoint pins one domain.

## Architecture

```
NL query (+ client-threaded history, + advisory hints)
   ▼
[0] Scope resolution (generic endpoint only)   Reports::ScopeResolver / ScopeClassifier
   ▼
[1] AI generates IR                            Reports::IrGenerator — forced `query_report`
                                               tool; schema generated from the scope's config
   ▼
[2] Validate IR against the config             Reports::IrValidator   → 422 on failure
   ▼
[3] Compile to a parameterized relation        Reports::IrCompiler      — joins from the curated
                                               FK graph; values bound via Arel
   ▼
[4] Execute + shape the envelope               Reports::QueryExecutor      → { spec, title, data,
                                               columns:[{name,type}], meta }
```

Orchestrated by `Reports::QueryService` (`app/services/reports/query_service.rb`), which maps
every outcome onto the HTTP taxonomy below. Controllers are thin actions over the
`Reports::ScopedQuery` concern (`app/controllers/concerns/reports/scoped_query.rb`).

### One engine, many endpoints

Scope is a **server-side decision — the client never submits it**:

| Route | Kind | Scope |
|---|---|---|
| `POST /api/v1/reports/query` | generic ("ask anything" / Chat) | resolved per request by `ScopeResolver` |
| `POST /api/v1/reports/orders_query` | focused (Orders surface) | pinned to `sales`; `hints.page` stripped |

Adding a focused endpoint for a new dataset = one route + one thin action pinning its scope.

### Scope routing (generic endpoint)

`ScopeResolver` picks exactly one configured scope before generation (the chosen scope selects
which config's cached schema prefix is used). Ladder, cheapest first: single configured scope →
`hints.page` honored via the deterministic `page_index` (unless the query lexically pulls to
another scope) → clear lexical winner → cheap-LLM `ScopeClassifier` tiebreak. The outcome,
including ambiguity (`{ scope, ambiguous, candidates }`), is surfaced in `meta.routing`.
Resolution is best-effort and single-shot — the engine never asks a clarifying question.

## Safety model: allowlist by construction

The model never writes SQL, and the pipeline is safe even if it tried:

1. **Access control is by absence.** Anything not in the scope's config is invisible to the
   model (not in the glossary or schema enums) *and* rejected by the validator. Sensitive
   columns are excluded simply by not being listed.
2. **The tool schema is the grammar.** Field names are JSON-Schema **enums generated from the
   config** (`additionalProperties: false` throughout) — hallucinated columns are structurally
   unemittable. Operators, aggregations, grains, directions, and relative-date tokens are closed
   enums sourced from `IrValidator`/`RelativeDate` constants, so schema and validator cannot drift.
3. **The validator re-checks everything** (defense in depth against any caller, not just the
   model): exposure, roles, operator legality per type, enum values, grain legality, sort refs
   against declared aliases, limit bounds, ISO date parseability.
4. **The compiler trusts only the config for identifiers** and binds all values through Arel —
   never interpolated. Joins come only from the curated `relationships` graph, never from the
   model. Model-supplied aliases are emitted through `quote_column_name`.

## The semantic config

One YAML per scope in `rails-backend/config/reports/<scope>.yml` — the single source of truth,
projected three ways: the model glossary (tool description), the tool-schema enums, and the
compiler's allowlist/lookup tables. Loaded and memoized per scope by `Reports::SemanticConfig`.

```yaml
source:
  name: sales            # the scope name
  root: order            # root entity (the IR `source`)
  pages: [sales_orders, sales_analytics]   # UI surfaces routed to this scope via hints.page

entities:
  order:
    table: sales_orders
    description: "A sales order placed by a customer …"   # orients the model
    fields:
      order_date:   { column: order_date,   type: date,    roles: [dimension, filter],
                      grains: [day, week, month, quarter, year] }
      order_status: { column: order_status, type: enum,    roles: [dimension, filter],
                      values: [pending, approved, …] }
      order_total:  { column: order_total,  type: decimal, roles: [measure, filter],
                      aggregations: [sum, avg, min, max] }
  warehouse:
    table: warehouses
    fields:
      name: { column: name, type: string, roles: [dimension, filter],
              description: 'full warehouse name, e.g. "Warehouse 2"', case_sensitive: false }

relationships:           # joins come ONLY from this curated graph
  order -> warehouse: { kind: belongs_to, foreign_key: warehouse_id, association: warehouse }
```

Per-field keys: `column`, `type` (`string|date|enum|decimal|integer`), `roles`
(`dimension|measure|filter` — which IR slots the field may fill), plus type-specific extras
(`aggregations`, `grains`, enum `values`). Two general-purpose keys added in Phase 1.9:

- **`description`** — rendered inline in the glossary; teaches the model a field's *shape*
  (e.g. codes look like "WH2") so loose references route to the right field. Value-agnostic —
  no per-value upkeep.
- **`case_sensitive: false`** — the compiler folds `eq`/`neq`/`in` with `LOWER()` (values still
  bound) so NL casing matches stored values. Absent ⇒ exact match.

Apply both to any reference name/code field as ambiguity surfaces; they are not warehouse-specific.

## Adding a scope (the playbook)

1. **Write `config/reports/<scope>.yml`** — `source` block (`name`/`root`/`pages`),
   `entities` with exposed fields, `relationships` keyed `<from> -> <target>`. Curation only:
   access control is by absence.
2. **Ensure the AR models + associations exist.** The compiler resolves the root model via
   `table.classify.constantize` and joins via real ActiveRecord associations named by
   `association:`. This is inherent to having the dataset at all, not engine code.
3. **Dev/test:** `Reports::SemanticConfig.reset_cache!` after editing YAML.
4. **Expose it:** it is immediately reachable through the generic endpoint (the resolver
   enumerates `SemanticConfig.available_scopes`); optionally add a focused endpoint — one route
   + one thin action pinning the scope.
5. Claim distinct `pages:` — a page claimed by two scopes raises at `page_index` build time.

The IR grammar, validator, compiler, and executor need **no changes** — they operate on whatever
scoped config they are handed.

## Request / response contract

```jsonc
// POST /api/v1/reports/query
{
  "query": "now just the completed ones",
  "history": [ { "query": "YTD sales by rep, top 5", "spec": { /* full IR */ } } ],
  "hints":   { "page": "sales_orders", "filters": { "order_status": "open" } }  // optional, advisory
}
```

- **History is client-threaded** (stateless server): prior `{query, spec}` turns; the model
  refines the most recent spec and always returns a **complete** spec, never a diff.
- **Hints are soft priors, never hard filters** — they may bias an ambiguous query but never
  widen/narrow the allowlist. The resolver also reads `hints.page` as a routing signal (generic
  endpoint only; focused endpoints strip it). Hints are injected *after* the prompt-cache
  breakpoint, so they never invalidate the cached per-scope prefix.

```jsonc
// 200 response envelope
{
  "spec":    { /* the IR — echoed for history + debug */ },
  "title":   "YTD sales by rep (top 5)",
  "data":    [ { "rep": "…", "revenue": 1234.5 } ],
  "columns": [ { "name": "rep", "type": "string" }, { "name": "revenue", "type": "decimal" } ],
  "meta":    { "row_count": 5, "truncated": false, "unsupported_note": null,
               "routing": { "scope": "sales", "ambiguous": false, "candidates": ["sales"] },
               "sql_debug": "…" /* non-production only */ }
}
```

| Outcome | HTTP | Shape |
|---|---|---|
| Rows returned | 200 | full envelope |
| Empty result | 200 | `data: []` — not an error |
| Model couldn't fully express / out-of-domain | 200 | best-effort `data` + `meta.unsupported_note` |
| Semantic validation failed | 422 | `{ error: { code: "validation_failed", details } }` |
| Malformed request / unknown scope | 400 | `{ error: { code: "bad_request" } }` |
| AI generation failure | 502 | `{ error: { code: "upstream_error" } }` |
| Unexpected (defensive) | 500 | `{ error: { code: "internal" } }` |

Out-of-domain questions on a focused endpoint are **not rejected**: foreign fields are
structurally unemittable, so the forced tool yields a best-effort in-scope query plus
`unsupported_note` — a soft 200.

## Date handling (hybrid, Phase 1.8)

- **Purely relative phrases** (today, this month, last quarter, YTD, last N days) → server-resolved
  `RelativeDate` tokens, fresh at execution time.
- **Named/specific periods** ("May", "Q2", "May 2026", bounded ranges) → the model computes an
  absolute ISO `between [start, end]` range from a **server clock block** injected per request
  *after* the prompt-cache breakpoint (no daily cache bust). A year-less period means its most
  recent already-elapsed occurrence ("May" asked 2026-06 → May 2026; "November" → Nov 2025).
- The validator rejects unparseable date strings on date fields, so a model slip fails as a
  clean 422 rather than a database error.

## Prompt caching

The cacheable prefix is `tools → system prompt`, both derived from the (stable) scope config; a
single `cache_control` breakpoint sits on the system-prompt block. Everything volatile — the
server clock, hints, history, the new utterance — lives strictly after it. The config is the
cache key in spirit: the prefix only changes when the config does, per scope.

## History

Built incrementally as Phase 1 → 1.9 (complete June 2026). Key commits: `88dad6f` (controller +
orchestrator), `e080339` (Phase 1.5: scope rename + hints), `be33526` (1.6: registry + focused
endpoints), `2bc63a0` (1.7: scope resolver), `6fd304c` (1.8: AI-resolved dates), `d2837d2`
(1.9: reference-field disambiguation). The legacy `parse_query` → `SalesOrdersController` filter
path predates the engine and is intentionally untouched. Phase 2 (backend hardening: fan-out
correctness, execution guardrails, envelope/decimal conventions) is in flight; Phase 3 adds
frontend views + view recommendation.

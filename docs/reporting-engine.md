# IR Reporting Engine

The reporting engine answers natural-language questions ("YTD sales by rep, top 5") by having
Claude emit a structured **query spec (IR)** — never SQL — which a deterministic backend pipeline
validates, compiles into a parameterized ActiveRecord/Arel query, executes, and returns as a
typed JSON envelope. This document describes the system **as built** through Phase 2
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
which config's cached schema prefix is used). Ladder, cheapest first:

1. **Single configured scope** — trivially resolved; no classifier needed.
2. **`hints.page` → `page_index`** — deterministic lookup; bypassed only if the query lexically
   pulls to a different scope.
3. **`ScopeClassifier`** — cheap-LLM tiebreak when the ladder hasn't resolved.

A configured default-scope fallback is used if the classifier is inconclusive. The resolution
outcome — including ambiguity flag and candidates — is surfaced in **`meta.query_scoping`**
(`{ scope, ambiguous, candidates }`). Resolution is best-effort and single-shot — the engine
never asks a clarifying question.

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
  "data":    [ { "rep": "Alice", "revenue": "1234.50" } ],
  "columns": [ { "name": "rep", "type": "string" }, { "name": "revenue", "type": "decimal" } ],
  "meta":    { "row_count": 5, "truncated": false, "limit": 100, "limit_defaulted": true,
               "unsupported_note": null,
               "query_scoping": { "scope": "sales", "ambiguous": false, "candidates": ["sales"] },
               "sql_debug": "…" /* non-production only */ }
}
```

**Decimal values are serialized as strings** (`"1234.50"`, not `1234.5`) so that JavaScript
consumers can display them without floating-point rounding. Parse with `Decimal`/`BigDecimal` or
string-formatting; never with `parseFloat` → `toFixed` (precision loss).

**`meta` fields:**
- `row_count` — rows in the response (after truncation).
- `truncated` — true when the result was capped at `limit`.
- `limit` — the row cap that was applied (default or explicit).
- `limit_defaulted` — true when `limit` was defaulted by the engine (not explicitly requested).
- `unsupported_note` — non-null on a soft-200 when the query was partially out-of-domain.
- `query_scoping` — scope-resolution record (generic endpoint only; absent on focused endpoints).
- `sql_debug` — the compiled SQL; present in non-production environments only.

| Outcome | HTTP | Shape |
|---|---|---|
| Rows returned | 200 | full envelope |
| Empty result | 200 | `data: []` — not an error |
| Model couldn't fully express / out-of-domain | 200 | best-effort `data` + `meta.unsupported_note` |
| Semantic validation failed | 422 | `{ error: { code: "validation_failed", details } }` |
| Malformed request / unknown scope | 400 | `{ error: { code: "bad_request" } }` |
| Statement timeout | 504 | `{ error: { code: "timeout" } }` |
| AI generation failure | 502 | `{ error: { code: "upstream_error" } }` |
| Unexpected (defensive) | 500 | `{ error: { code: "internal" } }` |

Out-of-domain questions on a focused endpoint are **not rejected**: foreign fields are
structurally unemittable, so the forced tool yields a best-effort in-scope query plus
`unsupported_note` — a soft 200.

**Guardrails.** The engine enforces two hard limits to protect shared infrastructure:
- **Default row limit** — results are capped (default 100 rows) unless a smaller explicit limit
  is in the IR. `meta.limit` always reflects the cap applied; `meta.limit_defaulted` is `true`
  when the engine chose it.
- **Statement timeout** — long-running queries are killed after a configured interval, returning
  504 `timeout`. The client should suggest narrowing the date range or adding filters.

## Aggregation semantics under fan-out

When a query joins across a `has_many` relationship (e.g. order → order_items), the grain shifts
and aggregation semantics tighten:

- **Filter-only references** (`filter` role, no `dimension`/`measure`) compile to `EXISTS` — no
  row multiplication. Safe to use freely.
- **`COUNT(*)`** counts at the *joined* grain (order_item rows, not orders). Use `count_distinct`
  on an order key if you want distinct order counts.
- **`sum`/`avg` of a root-side field** (e.g. `order_total`) under an item-side join is rejected
  with a **422** — it would produce double-counted aggregates. Model these at the order grain
  instead (omit the item-side dimension/filter that forces the join).

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

**Phase 1** — built incrementally (complete June 2026). Key commits: `88dad6f` (controller +
orchestrator), `e080339` (Phase 1.5: scope rename + hints), `be33526` (1.6: registry + focused
endpoints), `2bc63a0` (1.7: scope resolver), `6fd304c` (1.8: AI-resolved dates), `d2837d2`
(1.9: reference-field disambiguation).

**Phase 2** — backend hardening (complete June 2026). Key commits: `a325e96` (fan-out
correctness: `EXISTS` for filter-only has_many joins; 422 for root-side aggregates under
item-side joins), `2054964` (sql_adaptor rename; adapter selection moved to app-level config),
`616726e` (IrGenerator/scope_resolution rename), `6a3e3c0` (IrCompiler/QueryExecutor rename),
`85826d7` (variable naming: `dimensions` throughout IR compiler and validator). Envelope
conventions hardened: decimal values are strings; `meta` carries `limit`, `limit_defaulted`,
`query_scoping`, `sql_debug`. Outcome taxonomy extended with `timeout` (504).

The legacy `parse_query` → `SalesOrdersController` filter path predates the engine and is
intentionally untouched. Phase 3 adds frontend views + view recommendation.

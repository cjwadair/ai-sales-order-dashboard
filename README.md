## Order Managment Demo App

Mono repo for an Order Management application with AI enabled queries and filtering.

### AI reporting engine

Natural-language reporting (NL → structured query spec → safe parameterized SQL) is served by
the IR reporting engine in `rails-backend`, built and shipped as Phase 1 (through 1.9). See
[docs/reporting-engine.md](docs/reporting-engine.md) for the as-built architecture, safety
model, semantic-config reference, the "add a scope" playbook, and the API contract.

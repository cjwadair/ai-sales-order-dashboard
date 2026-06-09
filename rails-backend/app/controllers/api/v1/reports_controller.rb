class Api::V1::ReportsController < ApplicationController
  include Reports::ScopedQuery

  # Scope is decided by the endpoint, never the client (a focused endpoint pins one
  # domain; the generic Chat endpoint stays sales-pinned until Phase 1.7 adds the
  # scope resolver). `hints` is a soft, advisory bias only — never a hard filter.

  # POST /api/v1/reports/query
  # The generic ("ask anything" / Chat) endpoint. Sales-pinned for now; Phase 1.7
  # replaces this pin with the scope resolver (scope: "all" routing).
  def query
    run_scoped_query(scope: "sales")
  end

  # POST /api/v1/reports/orders_query
  # Focused sales endpoint backing the Orders surface — scope is fixed.
  def orders_query
    run_scoped_query(scope: "sales")
  end
end

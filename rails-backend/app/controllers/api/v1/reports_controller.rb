class Api::V1::ReportsController < ApplicationController
  include Reports::ScopedQuery

  # Scope is decided by the endpoint, never the client. The generic endpoint resolves
  # it from the query + hints; focused endpoints pin one domain. `hints` is a soft,
  # advisory bias only — never a hard filter.

  # POST /api/v1/reports/query
  # Generic ("ask anything" / Chat) endpoint: the scope resolver routes the request to
  # exactly one configured scope (Phase 1.7), then the shared pipeline runs. The chosen
  # scope + any ambiguity is surfaced in meta.routing.
  def query
    return if reject_blank_query

    resolution = Reports::ScopeResolver.new.resolve(params[:query].to_s.strip, hints: hints_param)
    run_scoped_query(scope: resolution.scope, routing: resolution)
  end

  # POST /api/v1/reports/orders_query
  # Focused sales endpoint backing the Orders surface — scope is fixed; the routing
  # hint (hints.page) is stripped so it can't leak a cross-scope signal.
  def orders_query
    run_scoped_query(scope: "sales", strip_page_hint: true)
  end
end

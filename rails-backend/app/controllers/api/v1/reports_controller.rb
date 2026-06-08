class Api::V1::ReportsController < ApplicationController
  # POST /api/v1/reports/query
  # Body: { query:, history: [{ query:, spec: }], hints: { page:, filters: {…} } }
  # Scope is NOT a client input — it's decided server-side (interim: hardcoded "sales").
  # Delegates to Reports::QueryService, which returns a Result already mapped to
  # the response taxonomy; we just render it.
  def query
    nl_query = params[:query].to_s.strip
    if nl_query.blank?
      return render json: { error: { code: "bad_request", message: "query is required" } },
                    status: :bad_request
    end

    # interim: scope is a controller-level decision, hardcoded pending Phase 1.6 (generic
    # scope:"all" + focused endpoints + resolver). The client does NOT submit scope; any
    # client-supplied scope/source param is ignored. `hints` is a soft, advisory bias only
    # (never a hard filter) — see plan "Phase 1.5".
    result = Reports::QueryService.new(
      query: nl_query,
      history: history_param,
      scope: "sales",
      hints: hints_param,
    ).call

    render json: result.body, status: result.status
  end

  private

  # History is client-threaded prior turns ([{ query:, spec: }]); normalize the
  # nested ActionController::Parameters into plain hashes for the generator.
  def history_param
    Array(params[:history]).map { |turn| turn.respond_to?(:to_unsafe_h) ? turn.to_unsafe_h : turn }
  end

  # Optional soft/advisory bias (e.g. { page:, filters: {…} }); normalize the nested
  # ActionController::Parameters into a plain hash for the generator. Never a hard filter.
  def hints_param
    hints = params[:hints]
    return {} if hints.blank?

    hints.respond_to?(:to_unsafe_h) ? hints.to_unsafe_h : hints
  end
end

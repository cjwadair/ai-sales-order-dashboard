class Api::V1::ReportsController < ApplicationController
  # POST /api/v1/reports/query
  # Body: { query:, history: [{ query:, spec: }], source: }
  # Delegates to Reports::QueryService, which returns a Result already mapped to
  # the response taxonomy; we just render it.
  def query
    nl_query = params[:query].to_s.strip
    if nl_query.blank?
      return render json: { error: { code: "bad_request", message: "query is required" } },
                    status: :bad_request
    end

    result = Reports::QueryService.new(
      query: nl_query,
      history: history_param,
      source: params[:source].presence || "sales",
    ).call

    render json: result.body, status: result.status
  end

  private

  # History is client-threaded prior turns ([{ query:, spec: }]); normalize the
  # nested ActionController::Parameters into plain hashes for the generator.
  def history_param
    Array(params[:history]).map { |turn| turn.respond_to?(:to_unsafe_h) ? turn.to_unsafe_h : turn }
  end
end

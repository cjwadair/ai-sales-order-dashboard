module Reports
  # Shared glue for every reports endpoint, parameterized by `scope`. Each action
  # is a thin wrapper that pins its scope and calls `run_scoped_query` — so adding a
  # focused endpoint for a new dataset is one route + one thin action, and the
  # generic (Chat) endpoint can later swap its pinned scope for the Phase 1.7
  # resolver without touching this glue.
  #
  # Scope is always a SERVER-SIDE decision (the action pins it); the client never
  # submits it. `QueryService` returns a Result already mapped to the response
  # taxonomy, so we just render it.
  module ScopedQuery
    extend ActiveSupport::Concern

    private

    def run_scoped_query(scope:)
      nl_query = params[:query].to_s.strip
      if nl_query.blank?
        return render json: { error: { code: "bad_request", message: "query is required" } },
                      status: :bad_request
      end

      result = Reports::QueryService.new(
        query: nl_query,
        history: history_param,
        scope: scope,
        hints: hints_param,
      ).call

      render json: result.body, status: result.status
    end

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
end

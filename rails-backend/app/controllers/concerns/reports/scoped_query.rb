module Reports
  # Shared glue for every reports endpoint, parameterized by `scope`. Each action
  # is a thin wrapper that decides its scope (a focused endpoint pins it; the generic
  # endpoint resolves it) and calls `run_scoped_query`.
  #
  # Scope is always a SERVER-SIDE decision; the client never submits it. `QueryService`
  # returns a Result already mapped to the response taxonomy, so we just render it.
  module ScopedQuery
    extend ActiveSupport::Concern

    private

    # routing         - optional ScopeResolver::Result (generic endpoint); its `meta`
    #                   is surfaced in the response as `meta.routing`.
    # strip_page_hint - focused endpoints drop `hints.page` so a cross-scope routing
    #                   signal can't leak into the generator's within-scope bias.
    def run_scoped_query(scope:, routing: nil, strip_page_hint: false)
      return if reject_blank_query

      hints = hints_param
      hints = hints.except("page", :page) if strip_page_hint

      result = Reports::QueryService.new(
        query: params[:query].to_s.strip,
        history: history_param,
        scope: scope,
        hints: hints,
        routing: routing&.meta,
      ).call

      render json: result.body, status: result.status
    end

    # Renders a 400 and returns true when the NL query is missing/blank.
    def reject_blank_query
      return false if params[:query].to_s.strip.present?

      render json: { error: { code: "bad_request", message: "query is required" } },
             status: :bad_request
      true
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

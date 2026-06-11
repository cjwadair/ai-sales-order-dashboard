module Reports
  # Shared glue for every reports endpoint, parameterized by `scope`. Each action
  # is a thin wrapper that decides its scope (a focused endpoint pins it; the generic
  # endpoint resolves it) and calls `run_scoped_query`.
  #
  # Scope is always a SERVER-SIDE decision; the client never submits it. `QueryService`
  # returns a Result already mapped to the response taxonomy, so we just render it.
  module ScopedQuery
    extend ActiveSupport::Concern

    PAGE_HINT_MAX    = 64   # max chars for hints.page
    FILTERS_MAX_KEYS = 20   # max keys in hints.filters
    FILTER_ARRAY_MAX = 20   # max elements per array value in hints.filters

    private

    # routing         - optional ScopeResolver::Result (generic endpoint); its `meta`
    #                   is surfaced in the response as `meta.routing`.
    # strip_page_hint - focused endpoints drop `hints.page` so a cross-scope routing
    #                   signal can't leak into the generator's within-scope bias.
    def run_scoped_query(scope:, routing: nil, strip_page_hint: false)
      return if reject_blank_query

      hints = hints_param
      hints = hints.except("page") if strip_page_hint

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

    # Optional soft/advisory bias forwarded to the generator. Shape-validated to the
    # known contract; unknown keys and over-limit payloads are silently dropped rather
    # than 400'd (hints are advisory — the request must never fail because of them).
    #
    # Allowed shape:
    #   page    — string, max PAGE_HINT_MAX chars
    #   filters — flat hash: scalar values, arrays of scalars, or { relative: string }
    def hints_param
      hints = params[:hints]
      return {} if hints.blank?

      raw = hints.respond_to?(:to_unsafe_h) ? hints.to_unsafe_h : hints.to_h
      whitelist_hints(raw)
    end

    def whitelist_hints(raw)
      result = {}

      if (page = raw["page"].presence)
        result["page"] = page.to_s.slice(0, PAGE_HINT_MAX)
      end

      if (filters = raw["filters"]) && filters.is_a?(Hash)
        result["filters"] = whitelist_filters(filters)
      end

      result
    end

    def whitelist_filters(raw)
      raw.first(FILTERS_MAX_KEYS).each_with_object({}) do |(key, value), out|
        v = whitelist_filter_value(value)
        out[key.to_s] = v unless v.nil?
      end
    end

    def whitelist_filter_value(value)
      case value
      when String, Numeric, TrueClass, FalseClass then value
      when Hash
        # Allow { relative: <string> } for date-relative hints only.
        rel = value["relative"] || value[:relative]
        { "relative" => rel.to_s } if rel.is_a?(String)
      when Array
        items = value.first(FILTER_ARRAY_MAX).select { |v| v.is_a?(String) || v.is_a?(Numeric) }
        items unless items.empty?
      end
    end
  end
end

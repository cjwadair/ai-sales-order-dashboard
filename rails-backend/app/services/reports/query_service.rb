module Reports
  # Orchestrates one NL -> report request end to end: generate IR -> validate ->
  # compile -> execute, mapping each outcome onto the Phase 1 HTTP taxonomy (see
  # plan ref D). Expected outcomes are returned as a Result (never raised), so
  # the controller can render them directly and ApplicationController's generic
  # error handling never intercepts this endpoint's contract.
  #
  #   rows / empty / unsupported_note -> 200 (success envelope)
  #   semantic validation failed       -> 422 validation_failed
  #   unknown scope / bad input        -> 400 bad_request
  #   AI generation failure            -> 502 upstream_error
  #   anything unexpected (defensive)  -> 500 internal
  class QueryService
    Result = Struct.new(:status, :body, keyword_init: true)

    # `scope` is the queryable domain envelope (interim: the controller passes "sales");
    # internal callers/tests may pass any scope. `hints` is a soft, advisory bias forwarded
    # to the generator — never a hard filter.
    #
    # `generator` is a test seam (decided to keep): request specs inject a mock generator
    # returning canned IR for each taxonomy outcome, instead of stubbing. Defaults to a real
    # QueryGenerator in production (see #generator_for).
    def initialize(query:, history: [], scope: "sales", hints: {}, generator: nil)
      @query = query
      @history = history
      @scope = scope
      @hints = hints
      @generator = generator
    end

    def call
      config = SemanticConfig.for(@scope)

      ir = generator_for(config).generate(@query, history: @history, hints: @hints)

      errors = IrValidator.new(config).validate(ir)
      return validation_failed(errors) if errors.any?

      compiled = Compiler.new(config).compile(ir)
      envelope = Executor.new.execute(compiled, ir)
      Result.new(status: :ok, body: envelope)
    rescue SemanticConfig::ConfigError => e
      bad_request(e.message)
    rescue QueryGenerator::GenerationError, Anthropic::Errors::Error => e
      upstream_error(e.message)
    rescue StandardError => e
      internal_error(e)
    end

    private

    def generator_for(config)
      @generator || QueryGenerator.new(config)
    end

    def validation_failed(errors)
      error_result(:unprocessable_content, "validation_failed",
                   "the generated query failed validation", details: errors)
    end

    def bad_request(message)
      error_result(:bad_request, "bad_request", message)
    end

    def upstream_error(message)
      error_result(:bad_gateway, "upstream_error", "could not generate a query: #{message}")
    end

    def internal_error(error)
      Rails.logger.error("[reports/query] #{error.class}: #{error.message}")
      error_result(:internal_server_error, "internal", "could not run the report")
    end

    def error_result(status, code, message, details: nil)
      error = { code: code, message: message }
      error[:details] = details if details
      Result.new(status: status, body: { error: error })
    end
  end
end

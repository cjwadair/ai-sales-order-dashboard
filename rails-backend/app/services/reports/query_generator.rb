module Reports
  # Calls Claude with the forced `query_report` tool to turn a natural-language
  # question (plus client-threaded history) into a Tier-1 IR spec. The model can
  # only emit what the generated tool schema allows; this service just threads
  # the conversation and returns the tool input as a plain string-keyed Hash.
  #
  # Prompt caching: the cacheable prefix is `tools → system`, both derived from
  # the (stable) semantic config. A single cache_control breakpoint on the last
  # system block caches the tool schema + glossary + system prompt together.
  # Nothing volatile lives in that prefix — relative dates are server-resolved
  # tokens, so unlike parse_query there is no per-request date to invalidate it.
  # History and the new utterance go in `messages`, after the breakpoint.
  class QueryGenerator
    # Matches the existing NL-parsing path (parse_query_controller). Bump to a
    # larger model here if richer IR generation needs it — it's one constant.
    MODEL = "claude-haiku-4-5".freeze
    MAX_TOKENS = 1024
    MAX_HISTORY = 5

    class GenerationError < StandardError; end

    SYSTEM_PROMPT = <<~PROMPT.freeze
      You translate natural-language questions about sales orders into a single
      structured report query by calling the `query_report` tool. Use ONLY the
      entities, fields, operators, aggregations, grains, and relative-date tokens
      defined in the tool schema and field glossary — never invent field names,
      and never compute calendar dates yourself (always use the provided
      relative-date tokens).

      Prefer aggregations (measures) when the user asks for totals, counts,
      averages, or any "by"-grouping. Give every dimension and measure a short,
      clear `as` alias, and reference those aliases in `sort`.

      If conversation history is present, treat the new message as a refinement
      of the most recent query spec unless it clearly starts a new topic. ALWAYS
      return the COMPLETE updated spec, never a diff or a partial spec.

      If the request needs something the schema cannot express (running totals,
      rankings, period-over-period, window functions), still return your best
      query and set `unsupported_note` describing what was missing.
    PROMPT

    def initialize(config, client: nil)
      @config = config
      @tool = ToolSchemaBuilder.new(config).build
      @client = client || default_client
    end

    # query   - the new NL utterance (String)
    # history - prior successful turns: [{ "query" => ..., "spec" => {IR} }, ...]
    # Returns the IR as a string-keyed Hash. Raises GenerationError if the model
    # returns no tool_use block; Anthropic::APIError propagates to the caller.
    def generate(query, history: [])
      response = @client.messages.create(
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: system_blocks,
        tools: [@tool],
        tool_choice: { type: "tool", name: ToolSchemaBuilder::TOOL_NAME },
        messages: build_messages(query, history),
      )

      extract_ir(response)
    end

    private

    def default_client
      Anthropic::Client.new(api_key: Rails.application.credentials.anthropic[:api_key])
    end

    # The cache breakpoint sits on this block; it caches tools + system.
    def system_blocks
      [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }]
    end

    # Full-spec-per-turn threading: each prior turn becomes a user utterance
    # followed by the assistant's returned spec, so the model refines the last
    # structured query rather than re-deriving it.
    def build_messages(query, history)
      messages = []
      Array(history).last(MAX_HISTORY).each do |turn|
        turn = turn.deep_stringify_keys if turn.respond_to?(:deep_stringify_keys)
        messages << { role: "user", content: turn["query"].to_s }
        messages << { role: "assistant", content: spec_text(turn["spec"]) }
      end
      messages << { role: "user", content: query.to_s }
      messages
    end

    def spec_text(spec)
      "Previous query spec:\n```json\n#{JSON.generate(spec)}\n```"
    end

    def extract_ir(response)
      block = Array(response.content).find { |b| tool_use?(b) }
      raise GenerationError, "model returned no query_report tool call" unless block

      # Normalize to a string-keyed Hash regardless of the SDK's block shape,
      # so the validator/compiler (string keys) consume it directly.
      JSON.parse(JSON.generate(block.input))
    end

    def tool_use?(block)
      block.is_a?(Anthropic::Models::ToolUseBlock) ||
        (block.respond_to?(:type) && block.type.to_s == "tool_use")
    end
  end
end

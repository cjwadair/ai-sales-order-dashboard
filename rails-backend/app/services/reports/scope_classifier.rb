module Reports
  # Cheap-LLM tiebreaker for the scope resolver: given an NL query and a set of
  # candidate scopes, returns the single best-fit scope name. Only invoked when no
  # deterministic signal (page hint) is present.
  # Returns nil when the model cannot return a usable result; the resolver owns the fallback.
  #
  # Mirrors IrGenerator's client + forced-tool pattern. The `client` seam lets
  # specs inject a fake instead of calling Anthropic.
  class ScopeClassifier
    MODEL = "claude-haiku-4-5".freeze
    MAX_TOKENS = 128
    TOOL_NAME = "select_scope".freeze

    def initialize(client: nil)
      @client = client || default_client
    end

    # query  - the NL utterance (String)
    # scopes - candidate scope names (Array<String>)
    # Returns one of `scopes`, or nil when the model returns nothing usable.
    def classify(query, scopes:)
      return scopes.first if scopes.size <= 1

      response = @client.messages.create(
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: system_prompt(scopes),
        tools: [tool(scopes)],
        tool_choice: { type: "tool", name: TOOL_NAME },
        messages: [{ role: "user", content: query.to_s }],
      )

      pick = extract_scope(response)
      scopes.include?(pick) ? pick : nil
    end

    private

    def default_client
      Anthropic::Client.new(api_key: Rails.application.credentials.anthropic[:api_key])
    end

    def system_prompt(scopes)
      catalog = scopes.map { |s| "- #{s}: #{SemanticConfig.for(s).root_entity[:description]}" }.join("\n")
      <<~PROMPT
        Route the user's question to exactly ONE dataset by calling `#{TOOL_NAME}`.
        Pick the single dataset whose data best answers the question.

        Available datasets:
        #{catalog}
      PROMPT
    end

    def tool(scopes)
      {
        name: TOOL_NAME,
        description: "Select the one dataset that best answers the user's question.",
        input_schema: {
          "type" => "object",
          "required" => ["scope"],
          "additionalProperties" => false,
          "properties" => { "scope" => { "type" => "string", "enum" => scopes } },
        },
      }
    end

    def extract_scope(response)
      block = Array(response.content).find do |b|
        b.is_a?(Anthropic::Models::ToolUseBlock) || (b.respond_to?(:type) && b.type.to_s == "tool_use")
      end
      block && JSON.parse(JSON.generate(block.input))["scope"]
    end
  end
end

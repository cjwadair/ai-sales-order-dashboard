require 'rails_helper'

RSpec.describe Reports::QueryGenerator do
  let(:config) { Reports::SemanticConfig.for("sales") }

  before { Reports::SemanticConfig.reset_cache! }

  # A stand-in for an Anthropic tool_use content block.
  ToolUseStub = Struct.new(:type, :input) do
    def initialize(input) = super("tool_use", input)
  end

  let(:ir) do
    {
      "source" => "order",
      "dimensions" => [{ "field" => "sales_rep.name", "as" => "rep" }],
      "measures"   => [{ "fn" => "sum", "field" => "order_total", "as" => "revenue" }],
      "sort"  => [{ "ref" => "revenue", "direction" => "desc" }],
      "limit" => 5,
    }
  end

  let(:messages_api) { instance_double("messages_api") }
  let(:client) { instance_double("client", messages: messages_api) }
  subject(:generator) { described_class.new(config, client: client) }

  def stub_response(content)
    allow(messages_api).to receive(:create).and_return(double(content: content))
  end

  describe "#generate" do
    it "returns the tool input as a string-keyed Hash" do
      stub_response([ToolUseStub.new(ir)])
      expect(generator.generate("YTD sales by rep, top 5")).to eq(ir)
    end

    it "symbol-keyed tool input is normalized to string keys" do
      stub_response([ToolUseStub.new({ source: "order", measures: [{ fn: "count" }] })])
      result = generator.generate("how many orders")
      expect(result).to eq("source" => "order", "measures" => [{ "fn" => "count" }])
    end

    it "forces the query_report tool and caches the tools+system prefix" do
      stub_response([ToolUseStub.new(ir)])
      generator.generate("YTD sales by rep")

      expect(messages_api).to have_received(:create) do |args|
        expect(args[:model]).to eq(described_class::MODEL)
        expect(args[:tool_choice]).to eq(type: "tool", name: "query_report")
        expect(args[:tools].first[:name]).to eq("query_report")

        system_block = args[:system].last
        expect(system_block[:cache_control]).to eq(type: "ephemeral")
        expect(system_block[:text]).to include("query_report")
      end
    end

    it "threads history as full-spec-per-turn, ending with the new query" do
      stub_response([ToolUseStub.new(ir)])
      history = [{ "query" => "sales by rep", "spec" => ir }]

      generator.generate("now just the completed ones", history: history)

      expect(messages_api).to have_received(:create) do |args|
        msgs = args[:messages]
        expect(msgs[0]).to eq(role: "user", content: "sales by rep")
        expect(msgs[1][:role]).to eq("assistant")
        expect(msgs[1][:content]).to include("revenue") # prior spec echoed
        expect(msgs.last).to eq(role: "user", content: "now just the completed ones")
      end
    end

    it "caps history to the most recent MAX_HISTORY turns" do
      stub_response([ToolUseStub.new(ir)])
      history = Array.new(8) { |i| { "query" => "q#{i}", "spec" => ir } }

      generator.generate("latest", history: history)

      expect(messages_api).to have_received(:create) do |args|
        user_turns = args[:messages].select { |m| m[:role] == "user" }
        # MAX_HISTORY history queries + the new one
        expect(user_turns.map { |m| m[:content] }).to eq(%w[q3 q4 q5 q6 q7] + ["latest"])
      end
    end

    it "raises GenerationError when no tool_use block is present" do
      stub_response([double(type: "text")])
      expect { generator.generate("hello") }
        .to raise_error(described_class::GenerationError, /no query_report tool call/)
    end
  end

  # One live end-to-end check. Skipped unless real credentials are configured,
  # so it never makes a network call in CI without an API key.
  describe "#generate (live)", :integration do
    it "produces a structurally valid IR for a known prompt" do
      api_key = Rails.application.credentials.dig(:anthropic, :api_key)
      skip "no Anthropic API key configured" if api_key.blank?

      generator = described_class.new(config)
      spec = generator.generate("total sales by sales rep this year, top 5")

      errors = Reports::IrValidator.new(config).validate(spec)
      expect(errors).to eq([]), "expected valid IR, got errors: #{errors} for spec #{spec}"
    end
  end
end

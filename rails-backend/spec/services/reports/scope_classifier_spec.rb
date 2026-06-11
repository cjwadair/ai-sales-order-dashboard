require 'rails_helper'

RSpec.describe Reports::ScopeClassifier do
  before { Reports::SemanticConfig.reset_cache! }

  let(:messages_api) { instance_double("messages_api") }
  let(:client) { instance_double("client", messages: messages_api) }
  subject(:classifier) { described_class.new(client:) }

  # A stand-in for an Anthropic tool_use content block (extract_scope duck-types on #type).
  def tool_use(input) = double(type: "tool_use", input:)

  def stub_response(content)
    allow(messages_api).to receive(:create).and_return(double(content: content))
  end

  describe "#classify" do
    it "short-circuits without an API call when only one scope is given" do
      stub_response([]) # make the method a spy so we can assert it was never called
      expect(classifier.classify("anything", scopes: ["sales"])).to eq("sales")
      expect(messages_api).not_to have_received(:create)
    end

    it "forces the select_scope tool with the candidate scopes as the enum" do
      stub_response([tool_use("scope" => "inventory")])
      result = classifier.classify("how much stock is left", scopes: %w[sales inventory])

      expect(result).to eq("inventory")
      expect(messages_api).to have_received(:create) do |args|
        expect(args[:tool_choice]).to eq(type: "tool", name: "select_scope")
        tool = args[:tools].first
        expect(tool[:name]).to eq("select_scope")
        expect(tool[:input_schema]["properties"]["scope"]["enum"]).to eq(%w[sales inventory])
      end
    end

    it "returns nil when the model returns nothing usable" do
      stub_response([double(type: "text")])
      expect(classifier.classify("ambiguous", scopes: %w[sales inventory])).to be_nil
    end

    it "returns nil when the model returns an out-of-set scope" do
      stub_response([tool_use("scope" => "ledger")])
      expect(classifier.classify("ambiguous", scopes: %w[sales inventory])).to be_nil
    end
  end
end

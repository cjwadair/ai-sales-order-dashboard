require 'rails_helper'

RSpec.describe Reports::ScopeResolver do
  before { Reports::SemanticConfig.reset_cache! }

  # Fake classifier: records its calls so we can assert the LLM path is only taken
  # on genuine ties / no-signal, and returns the first candidate deterministically.
  let(:classifier) do
    Class.new do
      attr_reader :calls
      def initialize = @calls = []
      def classify(query, scopes:)
        @calls << { query:, scopes: }
        scopes.first
      end
    end.new
  end

  subject(:resolver) { described_class.new(classifier:) }

  describe "#resolve" do
    it "returns the only scope (no scoring, no LLM) when one scope is configured" do
      single = described_class.new(available_scopes: ["sales"], page_index: {}, classifier:)
      result = single.resolve("literally anything")

      expect(result.scope).to eq("sales")
      expect(result.ambiguous).to be(false)
      expect(result.candidates).to eq(["sales"])
      expect(classifier.calls).to be_empty
    end

    context "with a hints.page prior" do
      it "honors the page's scope for an aligned query (no LLM)" do
        result = resolver.resolve("total revenue by rep", hints: { "page" => "sales_orders" })

        expect(result.scope).to eq("sales")
        expect(classifier.calls).to be_empty
      end

      it "honors the page for a vague query with no lexical signal" do
        result = resolver.resolve("show me the big ones", hints: { "page" => "sales_orders" })

        expect(result.scope).to eq("sales")
        expect(classifier.calls).to be_empty
      end

      it "overrides the page when the query is lexically pulled to another scope (gated override)" do
        result = resolver.resolve("how much inventory is left for sku 123", hints: { "page" => "sales_orders" })

        expect(result.scope).to eq("inventory")
        expect(classifier.calls).to be_empty # a clear lexical winner needs no LLM
      end

      it "ignores an unknown page and routes by the query" do
        result = resolver.resolve("orders by status this month", hints: { "page" => "no_such_page" })

        expect(result.scope).to eq("sales")
      end
    end

    context "without a page (free-form Chat)" do
      it "picks the dominant scope by vocabulary, no LLM" do
        result = resolver.resolve("quantity available grouped by product category")

        expect(result.scope).to eq("inventory")
        expect(classifier.calls).to be_empty
      end

      it "delegates to the classifier and marks ambiguous when there is no signal" do
        result = resolver.resolve("show me everything please")

        expect(classifier.calls.size).to eq(1)
        expect(result.ambiguous).to be(true)
        expect(result.candidates).to contain_exactly("sales", "inventory")
      end
    end
  end
end

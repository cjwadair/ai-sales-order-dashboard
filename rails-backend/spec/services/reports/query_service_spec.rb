require 'rails_helper'

RSpec.describe Reports::QueryService do
  before { Reports::SemanticConfig.reset_cache! }

  # A canned generator injected via the `generator:` seam — no Anthropic call. This is the
  # intended way to drive the service in specs (decided: inject, don't stub).
  def canned_generator(ir)
    instance_double(Reports::QueryGenerator, generate: ir)
  end

  describe "#call" do
    # Change A: the controller hardcodes scope: "sales", so the unknown-scope path is no
    # longer reachable from a request. It still maps ConfigError -> 400 here defensively,
    # for the programmatic callers Phase 1.6 introduces.
    it "maps an unknown scope (ConfigError) to a 400 bad_request" do
      result = described_class.new(
        query: "anything",
        scope: "ledger",
        generator: canned_generator({}),
      ).call

      expect(result.status).to eq(:bad_request)
      expect(result.body.dig(:error, :code)).to eq("bad_request")
    end

    it "runs an injected generator's IR through validate -> compile -> execute" do
      ir = { "source" => "order", "measures" => [{ "fn" => "count", "as" => "n" }] }

      result = described_class.new(
        query: "how many orders",
        scope: "sales",
        generator: canned_generator(ir),
      ).call

      expect(result.status).to eq(:ok)
      expect(result.body[:spec]).to eq(ir)
      expect(result.body[:data]).to eq([{ "n" => 0 }])
    end

    it "maps a statement timeout (QueryCanceled) to 504 with code 'timeout'" do
      ir = { "source" => "order", "measures" => [{ "fn" => "count", "as" => "n" }] }
      allow(ActiveRecord::Base.connection).to receive(:select_all)
        .and_raise(ActiveRecord::QueryCanceled)

      result = described_class.new(
        query: "how many orders",
        scope: "sales",
        generator: canned_generator(ir),
      ).call

      expect(result.status).to eq(:gateway_timeout)
      expect(result.body.dig(:error, :code)).to eq("timeout")
    end

    it "forwards scope, history, and hints to the generator" do
      ir = { "source" => "order", "measures" => [{ "fn" => "count", "as" => "n" }] }
      generator = canned_generator(ir)
      history = [{ "query" => "prior", "spec" => ir }]
      hints = { "page" => "sales_orders" }

      described_class.new(
        query: "again",
        history: history,
        scope: "sales",
        hints: hints,
        generator: generator,
      ).call

      expect(generator).to have_received(:generate).with("again", history: history, hints: hints)
    end
  end
end

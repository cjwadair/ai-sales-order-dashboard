require 'rails_helper'

RSpec.describe "Api::V1::Reports", type: :request do
  # Stub the AI generator so request specs are deterministic and offline; the
  # generator itself is unit-tested separately (with one live check).
  def stub_generator(ir)
    allow_any_instance_of(Reports::QueryGenerator).to receive(:generate).and_return(ir)
  end

  def stub_generator_raise(error)
    allow_any_instance_of(Reports::QueryGenerator).to receive(:generate).and_raise(error)
  end

  let(:sales_by_rep_ir) do
    {
      "source" => "order",
      "title" => "Sales by rep",
      "dimensions" => [{ "field" => "sales_rep.name", "as" => "rep" }],
      "measures"   => [{ "fn" => "sum", "field" => "order_total", "as" => "revenue" }],
      "sort"  => [{ "ref" => "revenue", "direction" => "desc" }],
      "limit" => 5,
    }
  end

  def post_query(query: "sales by rep", **extra)
    post "/api/v1/reports/query", params: { query: query, **extra }, as: :json
  end

  describe "POST /api/v1/reports/query" do
    context "valid query returning rows" do
      before do
        rep = create(:sales_rep, name: "Alice")
        create(:sales_order, :with_consignee, :with_supplier, :with_warehouse, sales_rep: rep, order_total: 100, order_date: Date.current)
        create(:sales_order, :with_consignee, :with_supplier, :with_warehouse, sales_rep: rep, order_total: 50, order_date: Date.current)
        stub_generator(sales_by_rep_ir)
      end

      it "returns 200 with the full success envelope" do
        post_query
        expect(response).to have_http_status(:ok)
        body = response.parsed_body
        expect(body["title"]).to eq("Sales by rep")
        expect(body["data"]).to eq([{ "rep" => "Alice", "revenue" => 150.0 }])
        expect(body["columns"]).to eq([
          { "name" => "rep", "type" => "string" },
          { "name" => "revenue", "type" => "decimal" },
        ])
        expect(body["meta"]["row_count"]).to eq(1)
        expect(body["spec"]).to eq(sales_by_rep_ir)
      end
    end

    context "valid query with an empty result" do
      before do
        stub_generator(sales_by_rep_ir.merge(
          "filters" => { "op" => "and", "conditions" => [
            { "field" => "sales_rep.name", "op" => "eq", "value" => "Nobody" },
          ] },
        ))
      end

      it "returns 200 with empty data (not an error)" do
        post_query
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["data"]).to eq([])
        expect(response.parsed_body["meta"]["row_count"]).to eq(0)
      end
    end

    context "model could not fully express the request" do
      before do
        stub_generator(sales_by_rep_ir.merge("unsupported_note" => "running totals are not supported"))
      end

      it "returns 200 best-effort with meta.unsupported_note" do
        post_query
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["meta"]["unsupported_note"]).to eq("running totals are not supported")
      end
    end

    context "generated IR fails semantic validation" do
      before do
        stub_generator(sales_by_rep_ir.merge("measures" => [{ "fn" => "sum", "field" => "order_status" }]))
      end

      it "returns 422 validation_failed with details" do
        post_query
        expect(response).to have_http_status(:unprocessable_content)
        error = response.parsed_body["error"]
        expect(error["code"]).to eq("validation_failed")
        expect(error["details"]).to include(/cannot sum "order_status"/)
      end
    end

    context "malformed request" do
      it "returns 400 when query is missing" do
        post "/api/v1/reports/query", params: {}, as: :json
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body.dig("error", "code")).to eq("bad_request")
      end
    end

    context "scope is a server-side decision" do
      before do
        rep = create(:sales_rep, name: "Alice")
        create(:sales_order, :with_consignee, :with_supplier, :with_warehouse, sales_rep: rep, order_total: 100, order_date: Date.current)
      end

      # The controller hardcodes scope: "sales" (interim, pending Phase 1.6) and never
      # reads a client scope/source param, so a bogus value is ignored — not honored as
      # an unknown scope. (The unknown-scope -> 400 path now lives at the service level;
      # see semantic_config_spec / query_service_spec.)
      it "ignores a client-supplied scope/source param and runs against sales" do
        stub_generator(sales_by_rep_ir)
        post_query(scope: "ledger", source: "ledger")
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body["data"]).to eq([{ "rep" => "Alice", "revenue" => 100.0 }])
      end
    end

    context "advisory hints" do
      before do
        rep = create(:sales_rep, name: "Alice")
        create(:sales_order, :with_consignee, :with_supplier, :with_warehouse, sales_rep: rep, order_total: 100, order_date: Date.current)
      end

      it "forwards hints to the generator" do
        hints = { "page" => "sales_orders", "filters" => { "order_status" => "open" } }
        expect_any_instance_of(Reports::QueryGenerator)
          .to receive(:generate)
          .with("the big ones", history: [], hints: hints)
          .and_return(sales_by_rep_ir)

        post "/api/v1/reports/query",
             params: { query: "the big ones", hints: hints },
             as: :json

        expect(response).to have_http_status(:ok)
      end
    end

    context "AI generation fails" do
      before { stub_generator_raise(Reports::QueryGenerator::GenerationError.new("no tool call")) }

      it "returns 502 upstream_error" do
        post_query
        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body.dig("error", "code")).to eq("upstream_error")
      end
    end

    context "execution blows up unexpectedly" do
      before do
        stub_generator(sales_by_rep_ir)
        allow_any_instance_of(Reports::Executor).to receive(:execute).and_raise(StandardError, "boom")
      end

      it "returns 500 internal" do
        post_query
        expect(response).to have_http_status(:internal_server_error)
        expect(response.parsed_body.dig("error", "code")).to eq("internal")
      end
    end

    context "threaded refinement" do
      before do
        rep = create(:sales_rep, name: "Alice")
        create(:sales_order, :with_consignee, :with_supplier, :with_warehouse, sales_rep: rep, order_total: 100, order_date: Date.current)
      end

      it "passes prior turns to the generator as history" do
        history = [{ "query" => "sales by rep", "spec" => sales_by_rep_ir }]
        expect_any_instance_of(Reports::QueryGenerator)
          .to receive(:generate)
          .with("now just the completed ones", history: history, hints: {})
          .and_return(sales_by_rep_ir)

        post "/api/v1/reports/query",
             params: { query: "now just the completed ones", history: history },
             as: :json

        expect(response).to have_http_status(:ok)
      end
    end
  end

  # The focused sales endpoint (Phase 1.6). Same pipeline as the generic endpoint,
  # but scope is pinned by the action rather than (eventually) resolved.
  describe "POST /api/v1/reports/orders_query" do
    before do
      rep = create(:sales_rep, name: "Alice")
      create(:sales_order, :with_consignee, :with_supplier, :with_warehouse, sales_rep: rep, order_total: 100, order_date: Date.current)
    end

    it "pins scope to sales and returns the success envelope" do
      stub_generator(sales_by_rep_ir)
      post "/api/v1/reports/orders_query", params: { query: "sales by rep" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"]).to eq([{ "rep" => "Alice", "revenue" => 100.0 }])
    end

    # An out-of-domain question can't reference foreign fields (enums are generated
    # from the sales config), so the model returns a best-effort query + unsupported_note
    # rather than an error: a soft 200, never a 4xx.
    it "returns a soft 200 with meta.unsupported_note for an out-of-domain question" do
      stub_generator(sales_by_rep_ir.merge("unsupported_note" => "this question is outside the sales dataset"))
      post "/api/v1/reports/orders_query", params: { query: "how much inventory is left for SKU 123?" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["meta"]["unsupported_note"]).to eq("this question is outside the sales dataset")
    end

    it "returns 400 when query is missing" do
      post "/api/v1/reports/orders_query", params: {}, as: :json
      expect(response).to have_http_status(:bad_request)
    end


    # A focused endpoint owns its scope, so a routing hint (hints.page) is meaningless
    # and is stripped before reaching the generator; the within-scope bias (filters) stays.
    it "strips hints.page before forwarding hints to the generator" do
      expect_any_instance_of(Reports::QueryGenerator)
        .to receive(:generate)
        .with("sales by rep", history: [], hints: { "filters" => { "order_status" => "open" } })
        .and_return(sales_by_rep_ir)

      post "/api/v1/reports/orders_query",
           params: { query: "sales by rep", hints: { page: "inventory_dashboard", filters: { order_status: "open" } } },
           as: :json

      expect(response).to have_http_status(:ok)
    end
  end

  # The generic endpoint resolves scope from the query + hints (Phase 1.7). Routing is
  # deterministic here (page-honored / clear lexical winner), so no LLM is involved.
  describe "POST /api/v1/reports/query — scope routing" do
    let(:inventory_by_warehouse_ir) do
      {
        "source" => "inventory",
        "title" => "Inventory by warehouse",
        "dimensions" => [{ "field" => "warehouse.name", "as" => "wh" }],
        "measures"   => [{ "fn" => "sum", "field" => "quantity_available", "as" => "qty" }],
      }
    end

    it "routes an inventory question to the inventory scope and surfaces meta.routing" do
      wh = create(:warehouse, name: "West")
      create(:inventory_item, warehouse: wh, quantity_available: 30)
      create(:inventory_item, warehouse: wh, quantity_available: 70)
      stub_generator(inventory_by_warehouse_ir)

      post "/api/v1/reports/query",
           params: { query: "quantity available by warehouse", hints: { page: "inventory" } },
           as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["data"]).to eq([{ "wh" => "West", "qty" => 100 }])
      routing = response.parsed_body.dig("meta", "routing")
      expect(routing["scope"]).to eq("inventory")
      expect(routing["ambiguous"]).to be(false)
    end

    it "routes a sales question to the sales scope" do
      rep = create(:sales_rep, name: "Alice")
      create(:sales_order, :with_consignee, :with_supplier, :with_warehouse, sales_rep: rep, order_total: 100, order_date: Date.current)
      stub_generator(sales_by_rep_ir)

      post "/api/v1/reports/query", params: { query: "total revenue by sales rep" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig("meta", "routing", "scope")).to eq("sales")
    end

  end
end

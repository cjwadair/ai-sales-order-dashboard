require 'rails_helper'

RSpec.describe Reports::Executor do
  let(:config) { Reports::SemanticConfig.for("sales") }
  let(:compiler) { Reports::Compiler.new(config) }
  subject(:executor) { described_class.new }

  before { Reports::SemanticConfig.reset_cache! }

  def order_for(rep, total)
    create(:sales_order, :with_consignee, :with_supplier, :with_warehouse, sales_rep: rep, order_total: total, order_date: Date.current)
  end

  let!(:alice) { create(:sales_rep, name: "Alice") }
  let!(:bob)   { create(:sales_rep, name: "Bob") }

  before do
    order_for(alice, 100)
    order_for(alice, 50)
    order_for(bob, 200)
  end

  let(:ir) do
    {
      "source" => "order",
      "title" => "Sales by rep",
      "dimensions" => [{ "field" => "sales_rep.name", "as" => "rep" }],
      "measures"   => [{ "fn" => "sum", "field" => "order_total", "as" => "revenue" }],
      "sort"  => [{ "ref" => "revenue", "direction" => "desc" }],
      "limit" => 5,
    }
  end

  it "returns the response envelope with grouped, cast, sorted data" do
    envelope = executor.execute(compiler.compile(ir), ir)

    expect(envelope[:title]).to eq("Sales by rep")
    expect(envelope[:columns]).to eq([
      { name: "rep", type: :string },
      { name: "revenue", type: :decimal },
    ])
    expect(envelope[:data]).to eq([
      { "rep" => "Bob",   "revenue" => 200.0 },
      { "rep" => "Alice", "revenue" => 150.0 },
    ])
    expect(envelope[:data].first["revenue"]).to be_a(Float)
  end

  it "reports row_count, truncation, limit, and limit_defaulted in meta" do
    envelope = executor.execute(compiler.compile(ir), ir)
    expect(envelope[:meta][:row_count]).to eq(2)
    expect(envelope[:meta][:truncated]).to be(false)         # 2 rows < limit 5
    expect(envelope[:meta][:limit]).to eq(5)
    expect(envelope[:meta][:limit_defaulted]).to be(false)   # explicit limit in IR
    expect(envelope[:meta][:unsupported_note]).to be_nil
    expect(envelope[:meta][:sql_debug]).to include("SUM")
  end

  it "applies the default MAX_LIMIT when IR has no limit and sets limit_defaulted: true" do
    limitless_ir = ir.except("limit").merge("title" => "no limit")
    envelope = executor.execute(compiler.compile(limitless_ir), limitless_ir)
    expect(envelope[:meta][:limit]).to eq(Reports::IrValidator::MAX_LIMIT)
    expect(envelope[:meta][:limit_defaulted]).to be(true)
    expect(envelope[:meta][:truncated]).to be(false) # only 2 rows
  end

  it "treats an empty result as success, not an error" do
    ir_empty = ir.merge("filters" => { "op" => "and", "conditions" => [
      { "field" => "sales_rep.name", "op" => "eq", "value" => "Nobody" },
    ] })
    envelope = executor.execute(compiler.compile(ir_empty), ir_empty)
    expect(envelope[:data]).to eq([])
    expect(envelope[:meta][:row_count]).to eq(0)
  end

  describe "EXISTS fan-out correctness" do
    it "does not inflate sum(order_total) when an order has multiple matching items" do
      # Order A has 2 items with sku=1 and order_total=100.
      # A naive JOIN would double-count A's total → 200. EXISTS must give 100.
      order_a = create(:sales_order, :with_consignee, :with_supplier, :with_warehouse,
                       sales_rep: alice, order_total: 100, order_date: Date.current)
      create(:sales_order_item, :with_product, sales_order: order_a, sku: 1)
      create(:sales_order_item, :with_product, sales_order: order_a, sku: 1)

      # Order B has one item with sku=2 — should not appear in results.
      order_b = create(:sales_order, :with_consignee, :with_supplier, :with_warehouse,
                       sales_rep: bob, order_total: 50, order_date: Date.current)
      create(:sales_order_item, :with_product, sales_order: order_b, sku: 2)

      ir = {
        "source"   => "order",
        "measures" => [{ "fn" => "sum", "field" => "order_total", "as" => "revenue" }],
        "filters"  => { "op" => "and", "conditions" => [
          { "field" => "sales_order_item.sku", "op" => "eq", "value" => 1 },
        ] },
      }
      envelope = executor.execute(compiler.compile(ir), ir)
      expect(envelope[:data]).to eq([{ "revenue" => 100.0 }])
    end
  end

  it "round-trips a human-readable alias through SQL into the JSON keys" do
    pretty_ir = ir.merge(
      "dimensions" => [{ "field" => "sales_rep.name", "as" => "Sales Rep" }],
      "measures"   => [{ "fn" => "sum", "field" => "order_total", "as" => "Total Sales" }],
      "sort"       => [{ "ref" => "Total Sales", "direction" => "desc" }],
    )
    envelope = executor.execute(compiler.compile(pretty_ir), pretty_ir)

    expect(envelope[:columns].map { |c| c[:name] }).to eq(["Sales Rep", "Total Sales"])
    expect(envelope[:data].first).to eq("Sales Rep" => "Bob", "Total Sales" => 200.0)
  end

  it "casts a count measure to an integer" do
    count_ir = { "source" => "order", "measures" => [{ "fn" => "count", "as" => "n" }] }
    envelope = executor.execute(compiler.compile(count_ir), count_ir)
    expect(envelope[:data]).to eq([{ "n" => 3 }])
    expect(envelope[:data].first["n"]).to be_a(Integer)
  end
end

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

  it "reports row_count and truncation in meta" do
    envelope = executor.execute(compiler.compile(ir), ir)
    expect(envelope[:meta][:row_count]).to eq(2)
    expect(envelope[:meta][:truncated]).to be(false)
    expect(envelope[:meta][:unsupported_note]).to be_nil
    expect(envelope[:meta][:sql_debug]).to include("SUM")
  end

  it "treats an empty result as success, not an error" do
    ir_empty = ir.merge("filters" => { "op" => "and", "conditions" => [
      { "field" => "sales_rep.name", "op" => "eq", "value" => "Nobody" },
    ] })
    envelope = executor.execute(compiler.compile(ir_empty), ir_empty)
    expect(envelope[:data]).to eq([])
    expect(envelope[:meta][:row_count]).to eq(0)
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

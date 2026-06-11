require 'rails_helper'

RSpec.describe Reports::IrCompiler do
  let(:config) { Reports::SemanticConfig.for("sales") }
  subject(:compiler) { described_class.new(config) }

  before { Reports::SemanticConfig.reset_cache! }

  describe "the YTD-sales-by-rep fixture" do
    let(:ir) do
      {
        "source" => "order",
        "dimensions" => [{ "field" => "sales_rep.name", "as" => "rep" }],
        "measures"   => [{ "fn" => "sum", "field" => "order_total", "as" => "revenue" }],
        "filters" => { "op" => "and", "conditions" => [
          { "field" => "order_date", "op" => "gte", "value" => { "relative" => "year_start" } },
        ] },
        "sort"  => [{ "ref" => "revenue", "direction" => "desc" }],
        "limit" => 5,
      }
    end

    let(:sql) { compiler.compile(ir).relation.to_sql }

    it "joins the sales_reps table" do
      expect(sql).to match(/INNER JOIN "sales_reps"/)
    end

    it "selects the dimension and aggregate with their aliases" do
      expect(sql).to include(%(SELECT "sales_reps"."name" AS "rep"))
      expect(sql).to include(%(SUM("sales_orders"."order_total") AS "revenue"))
    end

    it "groups by the dimension expression" do
      expect(sql).to include(%(GROUP BY "sales_reps"."name"))
    end

    it "binds the relative-date value (not interpolated as a token)" do
      expect(sql).to include(%("sales_orders"."order_date" >= '#{Date.current.beginning_of_year}'))
      expect(sql).not_to include("year_start")
    end

    it "orders by the measure alias and applies the limit" do
      expect(sql).to match(/ORDER BY "revenue" DESC/)
      expect(sql).to match(/LIMIT 5\b/)
    end

    it "reports column metadata with types" do
      cols = compiler.compile(ir).columns
      expect(cols).to eq([
        { name: "rep", type: :string },
        { name: "revenue", type: :decimal },
      ])
    end
  end

  describe "default limit guardrail" do
    it "applies MAX_LIMIT when the IR has no limit, and flags limit_defaulted" do
      ir = {
        "source"   => "order",
        "measures" => [{ "fn" => "count", "as" => "n" }],
      }
      compiled = compiler.compile(ir)
      expect(compiled.relation.to_sql).to match(/LIMIT #{Reports::IrValidator::MAX_LIMIT}\b/)
      expect(compiled.applied_limit).to eq(Reports::IrValidator::MAX_LIMIT)
      expect(compiled.limit_defaulted).to be(true)
    end

    it "uses the explicit limit when one is present and does not flag limit_defaulted" do
      ir = {
        "source"   => "order",
        "measures" => [{ "fn" => "count", "as" => "n" }],
        "limit"    => 50,
      }
      compiled = compiler.compile(ir)
      expect(compiled.relation.to_sql).to match(/LIMIT 50\b/)
      expect(compiled.applied_limit).to eq(50)
      expect(compiled.limit_defaulted).to be(false)
    end
  end

  describe "date grain" do
    it "wraps a dated dimension in date_trunc and groups by it" do
      ir = {
        "source" => "order",
        "dimensions" => [{ "field" => "order_date", "grain" => "month", "as" => "m" }],
        "measures" => [{ "fn" => "count" }],
      }
      result = compiler.compile(ir)
      expect(result.relation.to_sql).to include(%(date_trunc('month', "sales_orders"."order_date") AS "m"))
      expect(result.relation.to_sql).to include("COUNT(*)")
      expect(result.columns).to eq([{ name: "m", type: :date }, { name: "count", type: :integer }])
    end
  end

  describe "has_many filter-only: EXISTS instead of JOIN" do
    let(:item_filter_ir) do
      {
        "source"   => "order",
        "measures" => [{ "fn" => "sum", "field" => "order_total", "as" => "revenue" }],
        "filters"  => { "op" => "and", "conditions" => [
          { "field" => "sales_order_item.sku", "op" => "eq", "value" => 1 },
        ] },
      }
    end

    it "emits EXISTS instead of a JOIN when the has_many entity is filter-only" do
      sql = compiler.compile(item_filter_ir).relation.to_sql
      expect(sql).to include("EXISTS")
      expect(sql).not_to match(/JOIN.*sales_order_items/i)
    end

    it "includes the FK and item condition inside the EXISTS subquery" do
      sql = compiler.compile(item_filter_ir).relation.to_sql
      expect(sql).to include('"sales_order_items"."sales_order_id" = "sales_orders"."id"')
      expect(sql).to include('"sales_order_items"."sku"')
    end

    it "still uses a JOIN when the has_many entity is in dimensions" do
      ir = {
        "source"     => "order",
        "dimensions" => [{ "field" => "sales_order_item.description", "as" => "item" }],
        "measures"   => [{ "fn" => "sum", "field" => "sales_order_item.item_total", "as" => "total" }],
      }
      sql = compiler.compile(ir).relation.to_sql
      expect(sql).to match(/INNER JOIN "sales_order_items"/i)
      expect(sql).not_to include("EXISTS")
    end

    it "keeps non-item filter conditions in the main WHERE" do
      ir = item_filter_ir.merge("filters" => { "op" => "and", "conditions" => [
        { "field" => "sales_order_item.sku", "op" => "eq", "value" => 1 },
        { "field" => "order_date", "op" => "gte", "value" => "2024-01-01" },
      ] })
      sql = compiler.compile(ir).relation.to_sql
      expect(sql).to include("EXISTS")
      expect(sql).to include('"sales_orders"."order_date"')
    end
  end

  describe "filter operators" do
    def where_sql(condition)
      ir = { "source" => "order", "measures" => [{ "fn" => "count" }],
             "filters" => { "op" => "and", "conditions" => [condition] } }
      compiler.compile(ir).relation.to_sql
    end

    it "compiles an `in` list" do
      expect(where_sql("field" => "order_status", "op" => "in", "value" => %w[pending shipped]))
        .to include(%("sales_orders"."order_status" IN ('pending', 'shipped')))
    end

    it "compiles a `between` range" do
      sql = where_sql("field" => "order_total", "op" => "between", "value" => [10, 20])
      expect(sql).to include(%("sales_orders"."order_total" BETWEEN 10 AND 20))
    end

    it "compiles a case-insensitive `like`" do
      expect(where_sql("field" => "consignee.name", "op" => "like", "value" => "acme"))
        .to include(%("consignees"."name" ILIKE '%acme%'))
    end

    it "compiles `or` groups with grouping parens" do
      ir = { "source" => "order", "measures" => [{ "fn" => "count" }],
             "filters" => { "op" => "or", "conditions" => [
               { "field" => "order_status", "op" => "eq", "value" => "pending" },
               { "field" => "order_status", "op" => "eq", "value" => "shipped" },
             ] } }
      expect(compiler.compile(ir).relation.to_sql)
        .to include(%(("sales_orders"."order_status" = 'pending' OR "sales_orders"."order_status" = 'shipped')))
    end
  end

  describe "case-insensitive reference fields (case_sensitive: false)" do
    def where_sql(condition)
      ir = { "source" => "order", "measures" => [{ "fn" => "count" }],
             "filters" => { "op" => "and", "conditions" => [condition] } }
      compiler.compile(ir).relation.to_sql
    end

    it "folds both sides of `eq` to lower case so NL casing matches the stored value" do
      sql = where_sql("field" => "warehouse.code", "op" => "eq", "value" => "wh2")
      expect(sql).to include(%(LOWER("warehouses"."code") = 'wh2'))
    end

    it "folds `neq` as well" do
      sql = where_sql("field" => "warehouse.name", "op" => "neq", "value" => "Warehouse 2")
      expect(sql).to include(%(LOWER("warehouses"."name") != 'warehouse 2'))
    end

    it "folds each value of an `in` list" do
      sql = where_sql("field" => "warehouse.code", "op" => "in", "value" => %w[WH1 wh2])
      expect(sql).to include(%(LOWER("warehouses"."code") IN ('wh1', 'wh2')))
    end

    it "leaves a default (case-sensitive) string field as plain equality" do
      sql = where_sql("field" => "order_status", "op" => "eq", "value" => "pending")
      expect(sql).to include(%("sales_orders"."order_status" = 'pending'))
      expect(sql).not_to include("LOWER(")
    end
  end
end

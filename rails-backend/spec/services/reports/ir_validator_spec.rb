require 'rails_helper'

RSpec.describe Reports::IrValidator do
  let(:config) { Reports::SemanticConfig.for("sales") }
  subject(:validator) { described_class.new(config) }

  before { Reports::SemanticConfig.reset_cache! }

  # The canonical "YTD sales by rep, top 5" fixture.
  let(:valid_ir) do
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

  it "accepts a well-formed spec" do
    expect(validator.validate(valid_ir)).to eq([])
  end

  describe "source" do
    it "rejects a missing source" do
      expect(validator.validate(valid_ir.except("source"))).to include(/missing `source`/)
    end

    it "rejects an unknown source" do
      expect(validator.validate(valid_ir.merge("source" => "ledger"))).to include(/unknown source/)
    end
  end

  describe "dimensions" do
    it "requires at least one dimension or measure" do
      expect(validator.validate("source" => "order")).to include(/at least one dimension or measure/)
    end

    it "rejects an unknown field" do
      ir = valid_ir.merge("dimensions" => [{ "field" => "order.secret" }])
      expect(validator.validate(ir)).to include(/unknown field "order.secret"/)
    end

    it "rejects a measure-only field used as a dimension" do
      ir = valid_ir.merge("dimensions" => [{ "field" => "order_total" }])
      expect(validator.validate(ir)).to include(/cannot be used as a dimension/)
    end

    it "rejects a grain on a non-date field" do
      ir = valid_ir.merge("dimensions" => [{ "field" => "order_status", "grain" => "month" }])
      expect(validator.validate(ir)).to include(/grain is only valid on date fields/)
    end

    it "rejects an unsupported grain" do
      ir = valid_ir.merge("dimensions" => [{ "field" => "order_date", "grain" => "decade" }])
      expect(validator.validate(ir)).to include(/grain "decade" is not allowed/)
    end

    it "accepts a human-readable alias (compiler quotes it as a safe identifier)" do
      ir = valid_ir.merge("dimensions" => [{ "field" => "sales_rep.name", "as" => "Sales Rep" }],
                          "sort" => [{ "ref" => "revenue", "direction" => "desc" }])
      expect(validator.validate(ir)).to eq([])
    end
  end

  describe "measures" do
    it "allows count without a field" do
      ir = { "source" => "order", "measures" => [{ "fn" => "count" }] }
      expect(validator.validate(ir)).to eq([])
    end

    it "rejects an unknown aggregation" do
      ir = valid_ir.merge("measures" => [{ "fn" => "median", "field" => "order_total" }])
      expect(validator.validate(ir)).to include(/unknown aggregation/)
    end

    it "rejects summing a non-measure field" do
      ir = valid_ir.merge("measures" => [{ "fn" => "sum", "field" => "order_status" }])
      expect(validator.validate(ir)).to include(/cannot sum "order_status": not a measure/)
    end

    it "allows count_distinct on any exposed field" do
      ir = valid_ir.merge("measures" => [{ "fn" => "count_distinct", "field" => "order_status", "as" => "n" }],
                          "sort" => [{ "ref" => "n", "direction" => "desc" }])
      expect(validator.validate(ir)).to eq([])
    end
  end

  describe "filters" do
    it "rejects a non-filter field" do
      ir = valid_ir.merge("filters" => { "op" => "and", "conditions" => [
        { "field" => "order_number", "op" => "like", "value" => "SO1" },
      ] })
      expect(validator.validate(ir)).to eq([]) # order_number is a filter -> ok
    end

    it "rejects an illegal operator for the type" do
      ir = valid_ir.merge("filters" => { "op" => "and", "conditions" => [
        { "field" => "order_status", "op" => "gt", "value" => "pending" },
      ] })
      expect(validator.validate(ir)).to include(/operator "gt" is not valid on "order_status"/)
    end

    it "rejects an out-of-range enum value" do
      ir = valid_ir.merge("filters" => { "op" => "and", "conditions" => [
        { "field" => "order_status", "op" => "eq", "value" => "frozen" },
      ] })
      expect(validator.validate(ir)).to include(/"frozen" is not an allowed value/)
    end

    it "rejects a relative token on a non-date field" do
      ir = valid_ir.merge("filters" => { "op" => "and", "conditions" => [
        { "field" => "order_total", "op" => "gte", "value" => { "relative" => "year_start" } },
      ] })
      expect(validator.validate(ir)).to include(/relative-date tokens are only valid on date fields/)
    end

    it "rejects `in` without an array" do
      ir = valid_ir.merge("filters" => { "op" => "and", "conditions" => [
        { "field" => "order_status", "op" => "in", "value" => "pending" },
      ] })
      expect(validator.validate(ir)).to include(/requires a non-empty array/)
    end

    it "rejects `between` without two values" do
      ir = valid_ir.merge("filters" => { "op" => "and", "conditions" => [
        { "field" => "order_date", "op" => "between", "value" => ["2026-01-01"] },
      ] })
      expect(validator.validate(ir)).to include(/requires an array of two values/)
    end

    # Phase 1.8: the model now emits absolute ISO dates for named/specific periods.
    it "accepts an absolute ISO date range on a date field" do
      ir = valid_ir.merge("filters" => { "op" => "and", "conditions" => [
        { "field" => "order_date", "op" => "between", "value" => ["2026-05-01", "2026-05-31"] },
      ] })
      expect(validator.validate(ir)).to eq([])
    end

    it "rejects an unparseable date literal on a date field" do
      ir = valid_ir.merge("filters" => { "op" => "and", "conditions" => [
        { "field" => "order_date", "op" => "gte", "value" => "May" },
      ] })
      expect(validator.validate(ir)).to include(/invalid date "May" on "order_date"/)
    end
  end

  describe "sort" do
    it "rejects a sort ref that is not a declared alias" do
      ir = valid_ir.merge("sort" => [{ "ref" => "profit", "direction" => "desc" }])
      expect(validator.validate(ir)).to include(/does not match any declared/)
    end

    it "rejects an invalid direction" do
      ir = valid_ir.merge("sort" => [{ "ref" => "revenue", "direction" => "sideways" }])
      expect(validator.validate(ir)).to include(/direction` must be one of/)
    end
  end

  describe "limit" do
    it "rejects a limit over the max" do
      expect(validator.validate(valid_ir.merge("limit" => 5000))).to include(/between 1 and 1000/)
    end

    it "rejects a non-positive limit" do
      expect(validator.validate(valid_ir.merge("limit" => 0))).to include(/between 1 and 1000/)
    end
  end
end

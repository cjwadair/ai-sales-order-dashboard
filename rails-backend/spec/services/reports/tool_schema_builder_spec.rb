require 'rails_helper'

RSpec.describe Reports::ToolSchemaBuilder do
  let(:config) { Reports::SemanticConfig.for("sales") }
  subject(:builder) { described_class.new(config) }

  before { Reports::SemanticConfig.reset_cache! }

  describe "#build" do
    it "produces a forced-tool definition with the query_report name" do
      tool = builder.build
      expect(tool[:name]).to eq("query_report")
      expect(tool[:description]).to include("Translate the user's question")
      expect(tool[:input_schema]).to be_a(Hash)
    end

    it "embeds the field glossary in the description" do
      desc = builder.build[:description]
      expect(desc).to include("order_total (decimal, measure/filter)")
      expect(desc).to include("aggregations: sum, avg, min, max")
      expect(desc).to include("sales_rep.name (string, dimension/filter)")
    end

    it "renders a field description inline so the model learns the field's shape" do
      desc = builder.build[:description]
      expect(desc).to include(%(warehouse.code (string, dimension/filter) — short warehouse code, e.g. "WH2"))
    end
  end

  describe "#input_schema field enums" do
    let(:schema) { builder.input_schema }

    it "sets source to the root entity" do
      expect(schema.dig("properties", "source", "enum")).to eq(["order"])
    end

    it "generates dimension field enums exactly from the exposed dimension fields" do
      enum = schema.dig("properties", "dimensions", "items", "properties", "field", "enum")
      expect(enum).to eq(config.enum_fields(:dimension))
      expect(enum).to include("sales_rep.name", "consignee.industry")
      expect(enum).not_to include("order_total") # measure-only
    end

    it "generates measure field enums exactly from the exposed measure fields" do
      enum = schema.dig("properties", "measures", "items", "properties", "field", "enum")
      expect(enum).to eq(config.enum_fields(:measure))
      expect(enum).to include("order_total")
      expect(enum).not_to include("order_number")
    end

    it "generates filter field enums in the condition $def" do
      enum = schema.dig("$defs", "condition", "properties", "field", "enum")
      expect(enum).to eq(config.enum_fields(:filter))
    end

    it "never exposes unexposed columns anywhere in the schema" do
      json = schema.to_json
      expect(json).not_to include("licensee_number")
      expect(json).not_to include("consignee_id")
      expect(json).not_to include("supplier_number")
    end
  end

  describe "#input_schema closed vocabularies" do
    let(:schema) { builder.input_schema }

    it "uses the validator's aggregation, operator, and direction vocabularies" do
      expect(schema.dig("properties", "measures", "items", "properties", "fn", "enum"))
        .to eq(Reports::IrValidator::AGGREGATE_FNS)
      expect(schema.dig("$defs", "condition", "properties", "op", "enum"))
        .to eq(Reports::IrValidator::ALL_OPS)
      expect(schema.dig("properties", "sort", "items", "properties", "direction", "enum"))
        .to eq(Reports::IrValidator::DIRECTIONS)
    end

    it "uses the relative-date token vocabulary" do
      relative = schema.dig("$defs", "condition", "properties", "value", "oneOf")
                       .find { |s| s["type"] == "object" }
      expect(relative.dig("properties", "relative", "enum")).to eq(Reports::RelativeDate::TOKENS)
    end

    it "bounds the limit by the validator max" do
      expect(schema.dig("properties", "limit", "maximum")).to eq(Reports::IrValidator::MAX_LIMIT)
    end

    it "derives the grain enum from the config in canonical order" do
      expect(schema.dig("properties", "dimensions", "items", "properties", "grain", "enum"))
        .to eq(%w[day week month quarter year])
    end
  end

  describe "regeneration when the config changes" do
    it "reflects a reduced config (fewer exposed fields => fewer enums)" do
      reduced = instance_double(Reports::SemanticConfig,
        root_entity_name: "order",
        enum_fields: ["order_status"],
        glossary: [])
      allow(reduced).to receive(:enum_fields).with(:dimension).and_return(["order_status"])
      allow(reduced).to receive(:enum_fields).with(:measure).and_return([])
      allow(reduced).to receive(:enum_fields).with(:filter).and_return(["order_status"])

      schema = described_class.new(reduced).input_schema
      expect(schema.dig("properties", "dimensions", "items", "properties", "field", "enum"))
        .to eq(["order_status"])
      expect(schema.dig("$defs", "condition", "properties", "field", "enum"))
        .to eq(["order_status"])
    end
  end
end

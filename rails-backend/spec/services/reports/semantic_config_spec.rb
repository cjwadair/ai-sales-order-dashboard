require 'rails_helper'

RSpec.describe Reports::SemanticConfig do
  subject(:config) { described_class.for("sales") }

  before { described_class.reset_cache! }

  describe ".for" do
    it "loads the sales source" do
      expect(config.source_name).to eq("sales")
      expect(config.dialect).to eq("postgres")
      expect(config.root_entity_name).to eq("order")
    end

    it "memoizes per scope" do
      expect(described_class.for("sales")).to be(described_class.for("sales"))
    end

    it "raises for an unknown scope" do
      expect { described_class.for("nope") }.to raise_error(described_class::ConfigError, /unknown reporting scope/)
    end
  end

  describe ".available_scopes" do
    it "enumerates the configured scopes from config/reports/*.yml" do
      expect(described_class.available_scopes).to contain_exactly("sales", "inventory")
    end
  end

  describe ".page_index" do
    it "inverts each scope's source.pages into a page -> scope map" do
      expect(described_class.page_index).to include(
        "sales_orders" => "sales",
        "sales_analytics" => "sales",
        "inventory" => "inventory",
        "warehouses" => "inventory",
      )
    end
  end

  describe "#vocabulary" do
    it "collects distinctive tokens (source/entity/field/value names) for the scope" do
      vocab = described_class.for("inventory").vocabulary
      expect(vocab).to include("inventory", "warehouse", "product", "sku", "quantity", "available")
      expect(vocab).not_to include("order") # a sales term, absent from inventory
    end
  end

  describe "#field" do
    it "resolves an exposed root field to column/type/roles" do
      field = config.field("order", "order_total")
      expect(field).to include(
        entity: "order",
        column: "order_total",
        type: :decimal,
        table: "sales_orders",
      )
      expect(field[:roles]).to contain_exactly(:measure, :filter)
      expect(field[:aggregations]).to contain_exactly(:sum, :avg, :min, :max)
    end

    it "carries grains for a dated dimension" do
      expect(config.field("order", "order_date")[:grains]).to eq(%i[day week month quarter year])
    end

    it "carries enum values for an enum field" do
      expect(config.field("order", "order_status")[:values])
        .to eq(%w[pending approved processing shipped delivered completed])
    end

    it "defaults case_sensitive to true and carries no description" do
      field = config.field("order", "order_number")
      expect(field[:case_sensitive]).to be(true)
      expect(field[:description]).to be_nil
    end

    it "carries case_sensitive: false and a description for a reference field" do
      field = config.field("warehouse", "code")
      expect(field[:case_sensitive]).to be(false)
      expect(field[:description]).to include("WH2")
    end

    it "resolves an exposed related field" do
      expect(config.field("sales_rep", "name")).to include(
        entity: "sales_rep",
        column: "name",
        table: "sales_reps",
        ref: "sales_rep.name",
      )
    end

    it "returns nil for unexposed columns (absence is access control)" do
      expect(config.field("order", "id")).to be_nil
      expect(config.field("order", "consignee_id")).to be_nil
      expect(config.field("consignee", "licensee_number")).to be_nil
      expect(config.field("order", "nonsense")).to be_nil
    end

    it "returns nil for an unknown entity" do
      expect(config.field("secrets", "name")).to be_nil
    end
  end

  describe "#resolve" do
    it "resolves a bare ref against the root entity" do
      expect(config.resolve("order_total")[:entity]).to eq("order")
    end

    it "resolves a dotted ref against a related entity" do
      expect(config.resolve("consignee.industry")).to include(entity: "consignee", column: "industry")
    end

    it "returns nil for an unexposed ref" do
      expect(config.resolve("order.id")).to be_nil
    end
  end

  describe "#relationship" do
    it "resolves a belongs_to relationship keyed by target" do
      expect(config.relationship("sales_rep")).to include(
        from: "order",
        target: "sales_rep",
        kind: :belongs_to,
        foreign_key: "sales_rep_id",
        association: :sales_rep,
        table: "sales_reps",
      )
    end

    it "resolves a has_many relationship" do
      expect(config.relationship("sales_order_item")).to include(
        kind: :has_many,
        foreign_key: "sales_order_id",
        association: :sales_order_items,
      )
    end

    it "returns nil for an unknown relationship" do
      expect(config.relationship("unknown")).to be_nil
    end
  end

  describe "#enum_fields" do
    it "lists dimension refs (root bare, related dotted)" do
      dims = config.enum_fields(:dimension)
      expect(dims).to include("order_number", "order_date", "order_status", "sales_rep.name", "consignee.industry", "supplier.name")
      expect(dims).not_to include("order_total") # measure-only, not a dimension
    end

    it "lists measure refs" do
      expect(config.enum_fields(:measure)).to include("order_total", "sales_order_item.item_total")
      expect(config.enum_fields(:measure)).not_to include("order_number")
    end

    it "lists filter refs" do
      expect(config.enum_fields(:filter)).to include("order_total", "order_status", "sales_rep.name")
    end
  end

  describe "#glossary" do
    it "projects entities with their exposed fields" do
      order = config.glossary.find { |e| e[:entity] == "order" }
      expect(order[:root]).to be(true)
      expect(order[:table]).to eq("sales_orders")
      refs = order[:fields].map { |f| f[:ref] }
      expect(refs).to include("order_total", "order_status")
    end

    it "projects a field description when present" do
      warehouse = config.glossary.find { |e| e[:entity] == "warehouse" }
      code = warehouse[:fields].find { |f| f[:ref] == "warehouse.code" }
      expect(code[:description]).to include("WH2")
    end
  end
end

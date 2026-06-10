require 'rails_helper'

RSpec.describe SalesOrderItem, type: :model do
  it "is valid with valid attributes" do
    # consignee = Consignee.create(name: "John Doe", licensee_number: "12345", industry: "Retail")
    # supplier = Supplier.create(name: "Acme Corp", supplier_number: 123, company_code: "ACME")
    # sales_rep = SalesRep.create(name: "Jane Smith")
    # warehouse = Warehouse.create(name: "Main Warehouse", code: "WH1", location: "123 Main St")

    # sales_order = SalesOrder.create(
    #   order_number: "SO123",
    #   consignee: consignee,
    #   supplier: supplier,
    #   sales_rep: sales_rep,
    #   warehouse: warehouse,
    #   order_status: "Pending",
    #   payment_status: "Unpaid",
    #   order_total: 100.00,
    #   order_date: Date.today,
    #   delivery_date: Date.today + 7.days,
    #   order_type: "Delivery"
    # )

    # sales_order_item = SalesOrderItem.new(
    #   sales_order: sales_order,
    #   sku: 12345,
    #   description: "Sample Product",
    #   quantity_requested: 2,
    #   quantity_available: 2,
    #   unit_price: 50.00,
    #   item_total: 100.00
    # )
    sales_order = FactoryBot.create(:sales_order, :with_all_associations)
    sales_order_item = FactoryBot.build(:sales_order_item, :with_product, sales_order: sales_order)

    expect(sales_order_item).to be_valid
  end
end

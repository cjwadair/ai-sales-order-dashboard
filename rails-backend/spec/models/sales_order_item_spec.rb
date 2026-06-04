require 'rails_helper'

RSpec.describe SalesOrderItem, type: :model do
  it "is valid with valid attributes" do
    consignee = Consignee.create(name: "John Doe", licensee_number: "12345", industry: "Retail")
    supplier = Supplier.create(name: "Acme Corp", supplier_number: 123, company_code: "ACME")
    sales_rep = SalesRep.create(name: "Jane Smith")

    sales_order = SalesOrder.create(
      order_number: "SO123",
      consignee: consignee,
      supplier: supplier,
      sales_rep: sales_rep,
      order_status: "Pending",
      payment_status: "Unpaid",
      order_total: 100.00,
      order_date: Date.today,
      delivery_date: Date.today + 7.days,
      order_type: "Delivery"
    )

    sales_order_item = SalesOrderItem.new(
      sales_order: sales_order,
      sku: 12345,
      description: "Sample Product",
      quantity_requested: 2,
      quantity_available: 2,
      unit_price: 50.00,
      item_total: 100.00
    )

    expect(sales_order_item).to be_valid
  end
end

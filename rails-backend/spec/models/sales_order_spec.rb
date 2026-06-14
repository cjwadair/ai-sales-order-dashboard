require 'rails_helper'

RSpec.describe SalesOrder, type: :model do
  it "is valid with valid attributes" do
    consignee = create(:consignee)
    supplier = create(:supplier)
    sales_rep = create(:sales_rep)

    sales_order = build(:sales_order, :with_all_associations,
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

    expect(sales_order).to be_valid
  end

  describe "#by_order_date" do


    it "returns orders within the specified date range" do
      order1 = create(:sales_order, :with_all_associations, order_date: Date.today - 10.days)
      order2 = create(:sales_order, :with_all_associations, order_date: Date.today - 5.days)
      order3 = create(:sales_order, :with_all_associations, order_date: Date.today)

      expect(SalesOrder.by_order_date(Date.today - 7.days, Date.today)).to include(order2, order3)
      expect(SalesOrder.by_order_date(Date.today - 7.days, Date.today)).not_to include(order1)
    end

    it "defaults to the last 360 days if no dates are provided" do
      order1 = create(:sales_order, :with_all_associations, order_date: Date.today - 400.days)
      order2 = create(:sales_order, :with_all_associations, order_date: Date.today - 200.days)

      expect(SalesOrder.by_order_date(nil, nil)).to include(order2)
      expect(SalesOrder.by_order_date(nil, nil)).not_to include(order1)
    end

    it "defaults to current date if only 'to' date is provided" do
      order1 = create(:sales_order, :with_all_associations, order_date: Date.today - 10.days)
      order2 = create(:sales_order, :with_all_associations, order_date: Date.today)

      expect(SalesOrder.by_order_date(nil, Date.today)).to include(order1, order2)
    end

    it "defaults to 360 days ago if only 'from' date is provided" do
      order1 = create(:sales_order, :with_all_associations, order_date: Date.today - 400.days)
      order2 = create(:sales_order, :with_all_associations, order_date: Date.today - 200.days)

      expect(SalesOrder.by_order_date(Date.today - 360.days, nil)).to include(order2)
      expect(SalesOrder.by_order_date(Date.today - 360.days, nil)).not_to include(order1)
    end
  end

  describe "#by_delivery_date" do
    it "returns orders within the specified delivery date range" do
      order1 = create(:sales_order, :with_all_associations, delivery_date: Date.today - 10.days, order_date: Date.today - 20.days)
      order2 = create(:sales_order, :with_all_associations, delivery_date: Date.today - 5.days, order_date: Date.today - 15.days)
      order3 = create(:sales_order, :with_all_associations, delivery_date: Date.today, order_date: Date.today - 7.days)

      expect(SalesOrder.by_delivery_date(Date.today - 7.days, Date.today)).to include(order2, order3)
      expect(SalesOrder.by_delivery_date(Date.today - 7.days, Date.today)).not_to include(order1)
    end

    it "returns orders with delivery date after 'from' date if only 'from' is provided" do
      order1 = create(:sales_order, :with_all_associations, delivery_date: Date.today - 10.days, order_date: Date.today - 20.days)
      order2 = create(:sales_order, :with_all_associations, delivery_date: Date.today, order_date: Date.today - 7.days)

      expect(SalesOrder.by_delivery_date(Date.today - 7.days, nil)).to include(order2)
      expect(SalesOrder.by_delivery_date(Date.today - 7.days, nil)).not_to include(order1)
    end

    it "returns orders with delivery date before 'to' date if only 'to' is provided" do
      order1 = create(:sales_order, :with_all_associations, delivery_date: Date.today - 10.days, order_date: Date.today - 20.days)
      order2 = create(:sales_order, :with_all_associations, delivery_date: Date.today, order_date: Date.today - 7.days)
      expect(SalesOrder.by_delivery_date(nil, Date.today - 7.days)).to include(order1)
      expect(SalesOrder.by_delivery_date(nil, Date.today - 7.days)).not_to include(order2)
    end

    it "returns all orders if no dates are provided" do
      order1 = create(:sales_order, :with_all_associations, delivery_date: Date.today - 10.days, order_date: Date.today - 20.days)
      order2 = create(:sales_order, :with_all_associations, delivery_date: Date.today, order_date: Date.today - 7.days)
      expect(SalesOrder.by_delivery_date(nil, nil)).to include(order1, order2)
    end
  end

  describe "#by_status" do
    it "returns orders with the specified status" do
      order1 = create(:sales_order, :with_all_associations, order_status: "Pending")
      order2 = create(:sales_order, :with_all_associations, order_status: "Approved")

      expect(SalesOrder.by_status("Pending")).to include(order1)
      expect(SalesOrder.by_status("Pending")).not_to include(order2)
    end

    it "returns all orders if no status is provided" do
      order1 = create(:sales_order, :with_all_associations, order_status: "Pending")
      order2 = create(:sales_order, :with_all_associations, order_status: "Approved")

      expect(SalesOrder.by_status(nil)).to include(order1, order2)
    end

    it "returns all orders if empty status is provided" do
      order1 = create(:sales_order, :with_all_associations, order_status: "Pending")
      order2 = create(:sales_order, :with_all_associations, order_status: "Approved")

      expect(SalesOrder.by_status("")).to include(order1, order2)
    end
  end

  describe "#by_identifier" do
    it "returns orders matching the search term in order number, consignee name, supplier name, or sales rep name" do
      consignee = create(:consignee, name: "John Doe")
      supplier = create(:supplier, name: "Acme Corp")
      sales_rep = create(:sales_rep, name: "Jane Smith")

      order1 = create(:sales_order, :with_all_associations, order_number: "SO123", consignee: consignee, supplier: supplier, sales_rep: sales_rep)
      order2 = create(:sales_order, :with_all_associations, order_number: "SO456", consignee: consignee, supplier: supplier, sales_rep: sales_rep)

      expect(SalesOrder.by_identifier("SO123")).to include(order1)
      expect(SalesOrder.by_identifier("SO123")).not_to include(order2)

      expect(SalesOrder.by_identifier("John")).to include(order1, order2)
      expect(SalesOrder.by_identifier("Acme")).to include(order1, order2)
      expect(SalesOrder.by_identifier("Jane")).to include(order1, order2)
    end

    it "returns all orders if no search term is provided" do
      order1 = create(:sales_order, :with_all_associations)
      order2 = create(:sales_order, :with_all_associations)

      expect(SalesOrder.by_identifier(nil)).to include(order1, order2)
    end

    it "returns all orders if empty search term is provided" do
      order1 = create(:sales_order, :with_all_associations)
      order2 = create(:sales_order, :with_all_associations)

      expect(SalesOrder.by_identifier("")).to include(order1, order2)
    end
  end

  describe "#order_by" do
    it "orders by the specified column and direction" do
      order1 = create(:sales_order, :with_all_associations, order_date: Date.today - 10.days)
      order2 = create(:sales_order, :with_all_associations, order_date: Date.today)
      expect(SalesOrder.order_by("order_date", "asc")).to eq([order1, order2])
      expect(SalesOrder.order_by("order_date", "desc")).to eq([order2, order1])
    end
    
    it "orders by associated column when specified" do
      consignee1 = create(:consignee, name: "John Doe")
      consignee2 = create(:consignee, name: "Jane Smith")

      order1 = create(:sales_order, :with_all_associations, consignee: consignee1)
      order2 = create(:sales_order, :with_all_associations, consignee: consignee2)

      expect(SalesOrder.order_by("customer", "asc")).to eq([order2, order1])
      expect(SalesOrder.order_by("customer", "desc")).to eq([order1, order2])
    end

    it "sorts by association column when specified" do
      sales_rep1 = create(:sales_rep, name: "Alice")
      sales_rep2 = create(:sales_rep, name: "Bob")

      order1 = create(:sales_order, :with_all_associations, sales_rep: sales_rep1)
      order2 = create(:sales_order, :with_all_associations, sales_rep: sales_rep2)

      expect(SalesOrder.order_by("sales_rep", "asc")).to eq([order1, order2])
      expect(SalesOrder.order_by("sales_rep", "desc")).to eq([order2, order1])
    end
  end

  describe "#by_sales_rep" do
    it "returns orders matching the sales rep name" do
      sales_rep1 = create(:sales_rep, name: "Alice")
      sales_rep2 = create(:sales_rep, name: "Bob")

      order1 = create(:sales_order, :with_all_associations, sales_rep: sales_rep1)
      order2 = create(:sales_order, :with_all_associations, sales_rep: sales_rep2)

      expect(SalesOrder.by_sales_rep("Alice")).to include(order1)
      expect(SalesOrder.by_sales_rep("Alice")).not_to include(order2)
    end
  end

  describe "#by_consignee" do
    it "returns orders matching the consignee name" do
      consignee1 = create(:consignee, name: "John Doe")
      consignee2 = create(:consignee, name: "Jane Smith")

      order1 = create(:sales_order, :with_all_associations, consignee: consignee1)
      order2 = create(:sales_order, :with_all_associations, consignee: consignee2) 

      expect(SalesOrder.by_consignee("John Doe")).to include(order1)
      expect(SalesOrder.by_consignee("John Doe")).not_to include(order2)
    end
  end

  describe "#order_total_in_range" do
    it "returns orders with total greater than or equal to min" do
      order1 = create(:sales_order, :with_all_associations, order_total: 50.00)
      order2 = create(:sales_order, :with_all_associations, order_total: 100.00)
      expect(SalesOrder.order_total_in_range(75.00, nil)).to include(order2)
      expect(SalesOrder.order_total_in_range(75.00, nil)).not_to include(order1)
    end

    it "returns orders with total less than or equal to max" do
      order1 = create(:sales_order, :with_all_associations, order_total: 50.00)
      order2 = create(:sales_order, :with_all_associations, order_total: 100.00)
      expect(SalesOrder.order_total_in_range(nil, 75.00)).to include(order1)
      expect(SalesOrder.order_total_in_range(nil, 75.00)).not_to include(order2)
    end

    it "returns orders with total between min and max" do
      order1 = create(:sales_order, :with_all_associations, order_total: 50.00)
      order2 = create(:sales_order, :with_all_associations, order_total: 100.00)
      order3 = create(:sales_order, :with_all_associations, order_total: 75.00)
      expect(SalesOrder.order_total_in_range(50.00, 100.00)).to include(order1, order2, order3)
    end
  end

  describe "by_warehouse" do
    it "returns orders matching the warehouse name" do
      warehouse1 = create(:warehouse, name: "Warehouse A")
      warehouse2 = create(:warehouse, name: "Warehouse B")

      order1 = create(:sales_order, :with_all_associations, warehouse: warehouse1)
      order2 = create(:sales_order, :with_all_associations, warehouse: warehouse2)

      expect(SalesOrder.by_warehouse("Warehouse A")).to include(order1)
      expect(SalesOrder.by_warehouse("Warehouse A")).not_to include(order2)
    end
  end

  describe "by_order_type" do
    it "returns orders matching the order type" do
      order1 = create(:sales_order, :with_all_associations, order_type: "Delivery")
      order2 = create(:sales_order, :with_all_associations, :return_order)

      expect(SalesOrder.by_order_type("Delivery")).to include(order1)
      expect(SalesOrder.by_order_type("Delivery")).not_to include(order2)
    end

    it "returns all orders if no order type is provided" do
      order1 = create(:sales_order, :with_all_associations, order_type: "Delivery")
      order2 = create(:sales_order, :with_all_associations, :return_order)

      expect(SalesOrder.by_order_type(nil)).to include(order1, order2)
    end

    it "handles case-insensitive order type matching" do
      order1 = create(:sales_order, :with_all_associations, order_type: "Delivery")
      order2 = create(:sales_order, :with_all_associations, :return_order)

      expect(SalesOrder.by_order_type("delivery")).to include(order1)
      expect(SalesOrder.by_order_type("delivery")).not_to include(order2)
    end
  end
end
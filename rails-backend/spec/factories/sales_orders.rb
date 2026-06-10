FactoryBot.define do
  factory :sales_order do
    order_number { "SO#{rand(10000..99999)}" }
    order_status { "Pending" }
    payment_status { "Unpaid" }
    order_total { 9.99 }
    order_date { Date.today }
    delivery_date { order_date + 7.days }
    order_type { "Delivery" }
  end

  trait :with_consignee do
    association :consignee, factory: :consignee
  end

  trait :with_supplier do
    association :supplier, factory: :supplier
  end

  trait :with_sales_rep do
    association :sales_rep, factory: :sales_rep
  end

  trait :with_warehouse do
    association :warehouse, factory: :warehouse
  end

  trait :with_all_associations do
    with_consignee
    with_supplier
    with_sales_rep
    with_warehouse
  end
end

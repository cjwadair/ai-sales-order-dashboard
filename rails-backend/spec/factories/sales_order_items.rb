FactoryBot.define do
  factory :sales_order_item do
    description { "MyString" }
    quantity_requested { 1 }
    quantity_available { 1 }
    sku { 1 }
    unit_price { "9.99" }
    item_total { "9.99" }
    sales_order { nil }
  end

  trait :with_product do
    association :product, factory: :product
  end
end

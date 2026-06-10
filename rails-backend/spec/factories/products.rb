FactoryBot.define do
  factory :product do
    name { "MyString" }
    category { "MyString" }
    sequence(:sku) { |n| "SKU#{n}" } # products.sku has a unique index
    unit_price { "9.99" }
    association :supplier, factory: :supplier
  end
end

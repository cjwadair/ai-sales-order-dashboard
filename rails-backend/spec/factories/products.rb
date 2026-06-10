FactoryBot.define do
  factory :product do
    name { "MyString" }
    category { "MyString" }
    description { "MyString" }
    sku { "MyString" }
    unit_price { "9.99" }
    supplier { nil }
  end
end

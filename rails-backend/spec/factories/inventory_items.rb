FactoryBot.define do
  factory :inventory_item do
    quantity_available { 100 }
    association :warehouse, factory: :warehouse
    association :product, factory: :product
  end
end

FactoryBot.define do
  factory :warehouse do
    name { "#{Faker::Company.name} Warehouse" }
    location { "123 Warehouse St, Cityville" }
    code { "WH#{Faker::Number.unique.number(digits: 3)}" }
  end
end

FactoryBot.define do
  factory :consignee do
    name { "MyString" }
    licensee_number { rand(10000..99999) }
    industry { "MyString" }
  end
end

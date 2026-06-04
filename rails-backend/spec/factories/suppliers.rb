FactoryBot.define do
  factory :supplier do
    name { "MyString" }
    company_code { (0...4).map { (65 + rand(26)).chr }.join }
    supplier_number { rand(1000..9999) }
  end
end

require 'rails_helper'

RSpec.describe Supplier, type: :model do
  it "is valid with valid attributes" do
    supplier = Supplier.new(name: "Acme Corp", supplier_number: 123, company_code: "ACME")
    expect(supplier).to be_valid
  end
end

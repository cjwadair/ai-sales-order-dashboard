require 'rails_helper'

RSpec.describe SalesRep, type: :model do
  it "is valid with valid attributes" do
    sales_rep = SalesRep.new(name: "Jane Smith")
    expect(sales_rep).to be_valid
  end
end

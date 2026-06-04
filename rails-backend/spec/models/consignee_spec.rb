require 'rails_helper'

RSpec.describe Consignee, type: :model do
  it "is valid with valid attributes" do
    consignee = Consignee.new(name: "John Doe", licensee_number: "12345", industry: "Retail")
    expect(consignee).to be_valid
  end
end

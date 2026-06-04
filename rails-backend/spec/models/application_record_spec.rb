require 'rails_helper'

RSpec.describe ApplicationRecord, type: :model do
  it "exists" do
    expect(ApplicationRecord).to be_a Class
  end
end
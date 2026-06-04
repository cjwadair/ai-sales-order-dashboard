require 'rails_helper'

RSpec.describe "Api::V1::Suppliers", type: :request do
  describe "GET /index" do
    it "returns http success" do
      get "/api/v1/suppliers/index"
      expect(response).to have_http_status(:success)
    end
  end

  describe "GET /show" do
    it "returns http success" do
      get "/api/v1/suppliers/show"
      expect(response).to have_http_status(:success)
    end
  end

end

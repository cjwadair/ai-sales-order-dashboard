class Api::V1::FilterOptionsController < ApplicationController
  def index
    render json: {
      sales_reps: SalesRep.order(:name).pluck(:name),
      customers: Consignee.order(:name).pluck(:name),
      warehouses: Warehouse.order(:name).pluck(:name)
    }
  end
end

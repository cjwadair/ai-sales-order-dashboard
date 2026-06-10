class SalesOrderItem < ApplicationRecord
  belongs_to :sales_order
  belongs_to :product

  validates :sku, presence: true
  validates :description, presence: true

  validates :quantity_requested, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, if: -> { sales_order.order_type == "Delivery" }
  validates :quantity_available, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, if: -> { sales_order.order_type == "Delivery" }

  validates :quantity_requested, presence: true, numericality: { only_integer: true, less_than_or_equal_to: 0 }, if: -> { sales_order.order_type == "Return" }
  validates :quantity_available, presence: true, numericality: { only_integer: true, less_than_or_equal_to: 0 }, if: -> { sales_order.order_type == "Return" }

  validates :unit_price, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :item_total, presence: true, numericality: { greater_than_or_equal_to: 0, if: -> { sales_order.order_type == "Delivery" } }
  validates :item_total, presence: true, numericality: { less_than_or_equal_to: 0, if: -> { sales_order.order_type == "Return" } }
end

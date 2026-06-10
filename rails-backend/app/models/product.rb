class Product < ApplicationRecord
  belongs_to :supplier

  has_many :sales_order_items, dependent: :restrict_with_error
  has_many :sales_orders, through: :sales_order_items
  has_many :inventory_items, dependent: :destroy
  has_many :warehouses, through: :inventory_items
end

class Warehouse < ApplicationRecord
  # has_many :inventory_items, dependent: :destroy
  has_many :sales_orders, dependent: :restrict_with_error
  has_many :sales_order_items, through: :sales_orders

  has_many :inventory_items, dependent: :destroy
  has_many :products, through: :inventory_items

  validates :name, presence: true
  validates :code, presence: true, uniqueness: true
end

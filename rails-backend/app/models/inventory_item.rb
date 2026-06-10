class InventoryItem < ApplicationRecord
  belongs_to :warehouse
  belongs_to :product

  validates :quantity_available, numericality: { greater_than_or_equal_to: 0 }
end
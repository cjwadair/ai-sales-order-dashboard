class Supplier < ApplicationRecord
  has_many :sales_orders
  has_many :products

  validates :name, presence: true
  validates :company_code, presence: true, uniqueness: true
  validates :supplier_number, presence: true, uniqueness: true

end

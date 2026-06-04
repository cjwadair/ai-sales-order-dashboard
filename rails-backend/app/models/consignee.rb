class Consignee < ApplicationRecord
  has_many :sales_orders
  
  validates :name, presence: true
  validates :licensee_number, presence: true, uniqueness: true
  validates :industry, presence: true
end

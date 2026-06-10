class WarehouseSerializer < Panko::Serializer
  attributes :name, :code, :location

  # has_many :sales_orders
  # has_many :inventory_items
end
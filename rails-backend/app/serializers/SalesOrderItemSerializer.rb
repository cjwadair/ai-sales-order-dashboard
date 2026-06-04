class SalesOrderItemSerializer < Panko::Serializer

  attributes :description, :quantity_available, :quantity_requested, :unit_price, :sku
end
class SalesOrderSerializer < Panko::Serializer

  attributes :order_number, :order_date, :delivery_date, :order_status, :payment_status, :order_total, :order_type, :exception_type
  
  has_many :sales_order_items
  has_one :consignee
  has_one :supplier
  has_one :sales_rep
  has_one :warehouse

  def exception_type
    if object.order_type == "Return"
      'Return'
    else
      nil
    end
  end
end
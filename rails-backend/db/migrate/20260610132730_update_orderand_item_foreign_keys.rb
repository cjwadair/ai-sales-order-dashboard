class UpdateOrderandItemForeignKeys < ActiveRecord::Migration[8.1]
  def change
    add_reference :sales_orders, :warehouse, null: false, foreign_key: true
    add_reference :sales_order_items, :product, null: false, foreign_key: true
  end
end

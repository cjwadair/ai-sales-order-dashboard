class CreateSalesOrderItems < ActiveRecord::Migration[8.1]
  def change
    create_table :sales_order_items do |t|
      t.string :description
      t.integer :quantity_requested
      t.integer :quantity_available
      t.integer :sku
      t.decimal :unit_price
      t.decimal :item_total
      t.references :sales_order, null: false, foreign_key: true
      t.timestamps
    end
    add_index :sales_order_items, :sku
  end
end

class CreateSalesOrders < ActiveRecord::Migration[8.1]
  def change
    create_table :sales_orders do |t|
      t.string :order_number, null: false
      t.references :consignee, null: false, foreign_key: true
      t.references :supplier, null: false, foreign_key: true
      t.references :sales_rep, null: false, foreign_key: true
      t.string :order_status, null: false
      t.string :payment_status, null: false
      t.date :order_date, null: false
      t.date :delivery_date, null: false
      t.decimal :order_total, precision: 10, scale: 2
      t.string :order_type

      t.timestamps
    end
    add_index :sales_orders, :order_number, unique: true
    add_index :sales_orders, :order_status
    add_index :sales_orders, :payment_status
    add_index :sales_orders, :order_date
    add_index :sales_orders, :delivery_date
    add_index :sales_orders, :order_type
  end
end

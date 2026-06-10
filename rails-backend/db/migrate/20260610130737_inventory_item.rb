class InventoryItem < ActiveRecord::Migration[8.1]
  def change
    create_table :inventory_items do |t|
      t.references :warehouse, null: false, foreign_key: true
      t.references :product, null: false, foreign_key: true
      t.integer :quantity_available, null: false, default: 0
      t.timestamps
    end
  end
end

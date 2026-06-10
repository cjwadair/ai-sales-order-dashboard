class CreateProducts < ActiveRecord::Migration[8.1]
  def change
    create_table :products do |t|
      t.string :name
      t.string :category
      t.string :sku
      t.decimal :unit_price
      t.references :supplier, null: false, foreign_key: true

      t.timestamps
    end
    add_index :products, :sku, unique: true
  end
end

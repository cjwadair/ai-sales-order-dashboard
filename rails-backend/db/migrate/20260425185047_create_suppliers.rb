class CreateSuppliers < ActiveRecord::Migration[8.1]
  def change
    create_table :suppliers do |t|
      t.string :name
      t.string :company_code, null: false
      t.integer :supplier_number, null: false

      t.timestamps
    end
    add_index :suppliers, :name
    add_index :suppliers, :supplier_number, unique: true
  end
end

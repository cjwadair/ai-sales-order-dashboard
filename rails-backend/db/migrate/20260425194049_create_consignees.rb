class CreateConsignees < ActiveRecord::Migration[8.1]
  def change
    create_table :consignees do |t|
      t.string :name
      t.integer :licensee_number
      t.string :industry

      t.timestamps
    end
    add_index :consignees, :name
    add_index :consignees, :licensee_number, unique: true
    add_index :consignees, :industry
  end
end

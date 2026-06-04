class CreateSalesReps < ActiveRecord::Migration[8.1]
  def change
    create_table :sales_reps do |t|
      t.string :name, null: false

      t.timestamps
    end
    add_index :sales_reps, :name
  end
end

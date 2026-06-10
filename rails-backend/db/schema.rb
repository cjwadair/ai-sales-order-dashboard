# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_06_10_132730) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "consignees", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "industry"
    t.integer "licensee_number"
    t.string "name"
    t.datetime "updated_at", null: false
    t.index ["industry"], name: "index_consignees_on_industry"
    t.index ["licensee_number"], name: "index_consignees_on_licensee_number", unique: true
    t.index ["name"], name: "index_consignees_on_name"
  end

  create_table "inventory_items", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "product_id", null: false
    t.integer "quantity_available", default: 0, null: false
    t.datetime "updated_at", null: false
    t.bigint "warehouse_id", null: false
    t.index ["product_id"], name: "index_inventory_items_on_product_id"
    t.index ["warehouse_id"], name: "index_inventory_items_on_warehouse_id"
  end

  create_table "products", force: :cascade do |t|
    t.string "category"
    t.datetime "created_at", null: false
    t.string "name"
    t.string "sku"
    t.bigint "supplier_id", null: false
    t.decimal "unit_price"
    t.datetime "updated_at", null: false
    t.index ["sku"], name: "index_products_on_sku", unique: true
    t.index ["supplier_id"], name: "index_products_on_supplier_id"
  end

  create_table "sales_order_items", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "description"
    t.decimal "item_total"
    t.bigint "product_id", null: false
    t.integer "quantity_available"
    t.integer "quantity_requested"
    t.bigint "sales_order_id", null: false
    t.integer "sku"
    t.decimal "unit_price"
    t.datetime "updated_at", null: false
    t.index ["product_id"], name: "index_sales_order_items_on_product_id"
    t.index ["sales_order_id"], name: "index_sales_order_items_on_sales_order_id"
    t.index ["sku"], name: "index_sales_order_items_on_sku"
  end

  create_table "sales_orders", force: :cascade do |t|
    t.bigint "consignee_id", null: false
    t.datetime "created_at", null: false
    t.date "delivery_date", null: false
    t.date "order_date", null: false
    t.string "order_number", null: false
    t.string "order_status", null: false
    t.decimal "order_total", precision: 10, scale: 2
    t.string "order_type"
    t.string "payment_status", null: false
    t.bigint "sales_rep_id", null: false
    t.bigint "supplier_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "warehouse_id", null: false
    t.index ["consignee_id"], name: "index_sales_orders_on_consignee_id"
    t.index ["delivery_date"], name: "index_sales_orders_on_delivery_date"
    t.index ["order_date"], name: "index_sales_orders_on_order_date"
    t.index ["order_number"], name: "index_sales_orders_on_order_number", unique: true
    t.index ["order_status"], name: "index_sales_orders_on_order_status"
    t.index ["payment_status"], name: "index_sales_orders_on_payment_status"
    t.index ["sales_rep_id"], name: "index_sales_orders_on_sales_rep_id"
    t.index ["supplier_id"], name: "index_sales_orders_on_supplier_id"
    t.index ["warehouse_id"], name: "index_sales_orders_on_warehouse_id"
  end

  create_table "sales_reps", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_sales_reps_on_name"
  end

  create_table "suppliers", force: :cascade do |t|
    t.string "company_code", null: false
    t.datetime "created_at", null: false
    t.string "name"
    t.integer "supplier_number", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_suppliers_on_name"
    t.index ["supplier_number"], name: "index_suppliers_on_supplier_number", unique: true
  end

  create_table "warehouses", force: :cascade do |t|
    t.string "code", null: false
    t.datetime "created_at", null: false
    t.string "location"
    t.string "name", null: false
    t.datetime "updated_at", null: false
  end

  add_foreign_key "inventory_items", "products"
  add_foreign_key "inventory_items", "warehouses"
  add_foreign_key "products", "suppliers"
  add_foreign_key "sales_order_items", "products"
  add_foreign_key "sales_order_items", "sales_orders"
  add_foreign_key "sales_orders", "consignees"
  add_foreign_key "sales_orders", "sales_reps"
  add_foreign_key "sales_orders", "suppliers"
  add_foreign_key "sales_orders", "warehouses"
end

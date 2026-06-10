# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

# Single seeded RNG and Faker config — both must be fixed for full idempotency
rng = Random.new(42)
Faker::Config.random = Random.new(42)

def supplier_code(name)
  words = name.gsub(/[^a-zA-Z ]/, '')
              .split
              .reject { |w| %w[Inc Ltd LLC Corp Co and Group].include?(w) }
  initials = words.map { |w| w[0].upcase }.join
  first_word = words.first.to_s.upcase.gsub(/[^A-Z]/, '')
  (initials + first_word)[0, 3].ljust(3, "X")
end

product_categories = ["Electronics", "Apparel", "Home Goods", "Toys", "Books", "Sports Equipment", "Health & Beauty"]

# Create 10 sample suppliers
10.times do |i|
  name = Faker::Company.name
  code = supplier_code(name)
  number = 10001 + i

  Supplier.find_or_create_by!(supplier_number: number) do |s|
    s.name = name
    s.company_code = code
  end

  #create 10 products per supplier
  10.times do |j|
    product_name = Faker::Commerce.product_name
    category = product_categories.sample(random: rng)
    sku = rng.rand(100000..999999)
    price = Faker::Commerce.price(range: 10.0..100.0).round(2)

    Product.find_or_create_by!(sku: sku) do |p|
      p.name = product_name
      p.category = category
      p.supplier = Supplier.find_by(supplier_number: number)
      p.unit_price = price
    end
  end
end

#create 3 warehouses
3.times do |i|
  name = "Warehouse #{i + 1}"
  location = Faker::Address.city
  code = "WH#{i + 1}"

  Warehouse.find_or_create_by!(code: code) do |w|
    w.name = name
    w.location = location
  end
end

#add inventory items for each product in each warehouse with random quantities
Warehouse.all.each do |warehouse|
  Product.all.each do |product|
    quantity = rng.rand(0..100)
    InventoryItem.find_or_create_by!(warehouse: warehouse, product: product) do |ii|
      ii.quantity_available = quantity
    end
  end
end

# Create 25 sample consignees
25.times do |i|
  name = Faker::Company.name
  licensee_number = 20001 + i
  industry = Faker::Company.industry

  Consignee.find_or_create_by!(licensee_number: licensee_number) do |c|
    c.name = name
    c.industry = industry
  end
end

# Create 5 sample sales reps
5.times do
  name = Faker::Name.name
  SalesRep.find_or_create_by!(name: name)
end

# Create 10 to 100 sample sales orders per consignee with 1 to 5 items each
sales_reps = SalesRep.all.to_a
suppliers = Supplier.all.to_a
order_sequence = 10000

Consignee.find_each do |consignee|
  rng.rand(10..100).times do
    order_number = order_sequence.to_s
    order_sequence += 1

    order_date = rng.rand(730).days.ago.to_date
    delivery_date = order_date + rng.rand(3..10).days

    order_type = rng.rand(20) == 0 ? "Return" : "Delivery"

    warehouse = Warehouse.all.sample(random: rng)

    sales_order = SalesOrder.find_or_create_by!(order_number: order_number) do |so|
      so.consignee = consignee
      so.order_type = order_type
      so.order_status = %w[approved processing shipped delivered completed].sample(random: rng)
      so.payment_status = %w[unpaid paid refunded].sample(random: rng)
      so.sales_rep = sales_reps.sample(random: rng)
      so.supplier = suppliers.sample(random: rng)
      so.order_date = order_date
      so.delivery_date = delivery_date
      so.order_total = 0
      so.warehouse_id = warehouse.id
    end

    next unless sales_order.previously_new_record?

    total = 0
    rng.rand(1..5).times do
      product = Product.where(supplier: sales_order.supplier).sample(random: rng)
      next unless product
      quantity_requested = sales_order.order_type == "Return" ? -1 * rng.rand(1..10) : rng.rand(1..10)
      if sales_order.order_type == "Delivery"
        max = quantity_requested - 1
        max = 0 if max < 0
        quantity_available = rng.rand(20) == 0 ? rng.rand(0..max) : quantity_requested
      else
        quantity_available = quantity_requested
      end
      unit_price = rng.rand(10.0..100.0).round(2)
      item_total = (quantity_requested * unit_price).round(2)

      begin
        SalesOrderItem.create!(
          sales_order: sales_order,
          product: product,
          sku: product.sku,
          description: Faker::Commerce.product_name,
          quantity_requested: quantity_requested,
          quantity_available: quantity_available,
          unit_price: unit_price,
          item_total: item_total
        )
      rescue ActiveRecord::RecordInvalid => e
        puts "Skipping item for order #{order_number} due to validation error: #{e.message}"
        next
      end

      total += item_total
    end

    sales_order.update!(order_total: total)
  end
end

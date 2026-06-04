class SalesOrder < ApplicationRecord
  belongs_to :consignee
  belongs_to :supplier
  belongs_to :sales_rep

  has_many :sales_order_items, dependent: :destroy

  validates :order_number, presence: true, uniqueness: true
  validates :order_status, presence: true
  validates :payment_status, presence: true
  validates :order_total, presence: true, numericality: { greater_than_or_equal_to: 0, if: -> { order_type == "Delivery" } }
  validates :order_total, presence: true, numericality: { less_than_or_equal_to: 0, if: -> { order_type == "Return" } }
  validates :order_date, presence: true
  validates :delivery_date, presence: true
  validates :order_type, presence: true
  validates :delivery_date, comparison: { greater_than_or_equal_to: :order_date }

  def self.by_order_date(from, to)
    to = to || Date.current
    from = from || Date.current - 360.days
    where(order_date: from..to)
  end

  def self.by_delivery_date(from, to)
    if from && to
      where(delivery_date: from..to)
    elsif from
      where("delivery_date >= ?", from)
    elsif to
      where("delivery_date <= ?", to)
    else
      all
    end
  end

  STATUSES = %w[pending approved processing shipped delivered completed].freeze

  SORTABLE_COLUMNS = %w[order_date order_total delivery_date order_status order_number order_type].freeze

  ASSOCIATION_SORT_MAP = {
    "customer"  => { column: "consignees.name", join: :consignee },
    "sales_rep" => { column: "sales_reps.name", join: :sales_rep },
  }.freeze

  def self.by_status(status)
    status.present? ? where(order_status: status) : all
  end

  def self.by_identifier(search)
    if search.present?
      where("order_number ILIKE :search OR consignees.name ILIKE :search OR suppliers.name ILIKE :search OR sales_reps.name ILIKE :search", search: "%#{search}%")
      .joins(:consignee, :supplier, :sales_rep)
    else
      all
    end
  end

  def self.order_by(sort_by, sort_order)
    if (assoc = ASSOCIATION_SORT_MAP[sort_by])
      joins(assoc[:join]).order(Arel.sql("#{assoc[:column]} #{sort_order}"))
    else
      order(Arel.sql("#{sort_by} #{sort_order}"))
    end
  end

  def self.by_sales_rep(sales_rep)
    sales_rep.present? ? joins(:sales_rep).where("sales_reps.name ILIKE ?", "%#{sales_rep}%") : all
  end

  def self.by_consignee(consignee)
    consignee.present? ? joins(:consignee).where("consignees.name ILIKE ?", "%#{consignee}%") : all
  end

  def self.order_total_in_range(min, max)
    scope = all
    scope = scope.where("order_total >= ?", min) if min.present?
    scope = scope.where("order_total <= ?", max) if max.present?
    scope
  end
  
end

class Api::V1::SalesOrdersController < ApplicationController
  include ParamParseable

  def index
    order_from, order_to = parse_order_date_params
    delivery_from, delivery_to = parse_delivery_date_params
    sort_by, sort_order = parse_sort_params
    status = parse_status_param
    identifier = params[:search]
    page = params[:page].to_i > 0 ? params[:page].to_i : 1

    query = SalesOrder
      .includes(:sales_order_items, :consignee, :supplier, :sales_rep, :warehouse)
      .by_order_date(order_from, order_to)
      .by_delivery_date(delivery_from, delivery_to)
      .by_status(status)
      .by_identifier(identifier)
      .by_sales_rep(params[:sales_rep])
      .by_consignee(params[:customer])
      .by_warehouse(params[:warehouse])
      .by_order_type(params[:order_type])
      .order_total_in_range(params[:order_total_min], params[:order_total_max])
      .order_by(sort_by, sort_order)

    count = query.count

    @sales_orders = query 
      .limit(50)
      .offset((page - 1) * 50)

    render json: {
      data: JSON.parse(Panko::ArraySerializer.new(@sales_orders, each_serializer: SalesOrderSerializer).to_json),
      meta: {
        page: page,
        per_page: 50,
        total_count: count,
        total_pages: (count / 50.0).ceil
      }
    }
  end

  def show
    @sales_order = SalesOrderSerializer
      .new(
        SalesOrder.includes(:sales_order_items, :consignee, :supplier, :sales_rep, :warehouse).find(params[:id])
      )
      .serializable_hash
      .to_json

    render json: @sales_order
  end

  private

  def parse_order_date_params
    from = parse_date_param(params[:order_date_from]) || Date.current - 360.days
    to = parse_date_param(params[:order_date_to]) || Date.current
    [from, to]
  end

  def parse_delivery_date_params
    from = parse_date_param(params[:delivery_date_from])
    to = parse_date_param(params[:delivery_date_to])
    [from, to]
  end

  def parse_status_param
    parse_permitted_value_param(:status, params[:status], SalesOrder::STATUSES)
  end

  def parse_sort_params
    sort_by = parse_sortable_param(
      :sort_by, 
      params[:sort_by],
      SalesOrder::SORTABLE_COLUMNS + SalesOrder::ASSOCIATION_SORT_MAP.keys,
      default: "order_date"
    )

    sort_order = parse_sortable_param(
      :sort_order, 
      params[:sort_order], 
      %w[asc desc],
      default: "desc"
    )

    [sort_by, sort_order]
  end
end

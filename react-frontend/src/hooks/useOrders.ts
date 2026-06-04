import { useEffect, useRef, useState } from 'react'
import type { SortState } from '../components/GridTable'
import { camelToSnakeCase } from '../utils/formatters'

export const orderStatuses = ['pending', 'approved', 'processing', 'shipped', 'delivered', 'completed'] as const

export type OrderStatus = (typeof orderStatuses)[number]

export type Order = {
  orderNumber: string
  orderType: string
  orderDate: string
  customer: string
  salesRep: string
  orderTotal: number
  deliveryDate: string
  orderStatus: OrderStatus
  exceptionType?: string
}

type SalesOrderResponse = {
  order_number: string
  order_type: string
  order_date: string
  delivery_date: string
  order_status: string
  order_total: number
  exception_type?: string
  consignee: { name: string }
  sales_rep: { name: string }
}

type SalesOrderMeta = {
  page: number
  per_page: number
  total_count: number
  total_pages: number
}

type UseOrdersParams = {
  searchTerm: string
  orderDateFrom: Date | undefined
  orderDateTo: Date | undefined
  deliveryDateFrom: Date | undefined
  deliveryDateTo: Date | undefined
  selectedStatus: OrderStatus | undefined
  salesRep: string | undefined
  customer: string | undefined
  orderTotalMin: number | undefined
  orderTotalMax: number | undefined
  sort: SortState<Order>
  page: number
}

type FetchState = {
  /** True only on the very first fetch when there is no data yet to show. */
  isLoading: boolean
  /** True whenever any fetch is in-flight (including filter/search changes). */
  isFetching: boolean
  error: string | null
}

type UseOrdersResult = {
  orders: Order[]
  isLoading: boolean
  isFetching: boolean
  error: string | null
  totalPages: number
}

function mapOrder(o: SalesOrderResponse): Order {
  return {
    orderNumber: o.order_number,
    orderType: o.order_type,
    orderDate: o.order_date,
    customer: o.consignee.name,
    salesRep: o.sales_rep.name,
    orderTotal: o.order_total,
    deliveryDate: o.delivery_date,
    orderStatus: o.order_status as OrderStatus,
    exceptionType: o.exception_type,
  }
}

export function useOrders({
  searchTerm,
  orderDateFrom,
  orderDateTo,
  deliveryDateFrom,
  deliveryDateTo,
  selectedStatus,
  salesRep,
  customer,
  orderTotalMin,
  orderTotalMax,
  sort,
  page,
}: UseOrdersParams): UseOrdersResult {
  const [orders, setOrders] = useState<Order[]>([])
  const [fetchState, setFetchState] = useState<FetchState>({ isLoading: true, isFetching: true, error: null })
  const [totalPages, setTotalPages] = useState(1)
  const prevPageRef = useRef(0)
  // Tracks whether we have ever successfully received data. Once true, filter
  // changes show stale data (dimmed) rather than replacing the table with a
  // full-page loading state.
  const hasDataRef = useRef(false)

  useEffect(() => {
    const shouldAppend = page > 1 && page > prevPageRef.current
    prevPageRef.current = page

    const params = new URLSearchParams()
    if (searchTerm.trim()) params.set('search', searchTerm.trim())
    if (selectedStatus) params.set('status', selectedStatus)
    if (orderDateFrom) params.set('order_date_from', orderDateFrom.toISOString().slice(0, 10))
    if (orderDateTo) params.set('order_date_to', orderDateTo.toISOString().slice(0, 10))
    if (deliveryDateFrom) params.set('delivery_date_from', deliveryDateFrom.toISOString().slice(0, 10))
    if (deliveryDateTo) params.set('delivery_date_to', deliveryDateTo.toISOString().slice(0, 10))
    if (salesRep) params.set('sales_rep', salesRep)
    if (customer) params.set('customer', customer)
    if (orderTotalMin !== undefined) params.set('order_total_min', orderTotalMin.toString())
    if (orderTotalMax !== undefined) params.set('order_total_max', orderTotalMax.toString())
    params.set('sort_by', camelToSnakeCase(sort.field))
    params.set('sort_order', sort.order)
    if (page > 1) params.set('page', page.toString())

    const query = params.size > 0 ? `?${params}` : ''

    // isLoading — only true on the very first fetch (no rows to show yet).
    // isFetching — true for every in-flight request, including filter changes.
    // Infinite-scroll appends are silent (neither flag is raised).
    setFetchState({
      isLoading: !hasDataRef.current && !shouldAppend,
      isFetching: !shouldAppend,
      error: null,
    })

    const controller = new AbortController()

    fetch(`/api/v1/sales_orders${query}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`)
        return res.json() as Promise<{ data: SalesOrderResponse[]; meta: SalesOrderMeta }>
      })
      .then((json) => {
        hasDataRef.current = true
        setOrders((prev) => shouldAppend ? [...prev, ...json.data.map(mapOrder)] : json.data.map(mapOrder))
        setTotalPages(json.meta.total_pages)
        setFetchState({ isLoading: false, isFetching: false, error: null })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Ignore abort errors which are expected during cleanup
          return
        }
        setFetchState({ isLoading: false, isFetching: false, error: err instanceof Error ? err.message : 'Failed to load orders' })
      })

    return () => { controller.abort(); prevPageRef.current = 0 }
  }, [searchTerm, orderDateFrom, orderDateTo, deliveryDateFrom, deliveryDateTo, selectedStatus, salesRep, customer, orderTotalMin, orderTotalMax, sort, page])

  return { orders, isLoading: fetchState.isLoading, isFetching: fetchState.isFetching, error: fetchState.error, totalPages }
}

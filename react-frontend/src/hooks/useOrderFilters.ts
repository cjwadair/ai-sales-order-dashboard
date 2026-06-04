import { useCallback, useMemo } from 'react'
import { type SortState } from '../components/GridTable'
import { type FilterConfig } from '../components/FilterBar'
import { useAiSearch, type ParsedFilters } from './useAiSearch'
import { orderStatuses, type Order, type OrderStatus } from './useOrders'

type DateFilter = { from: Date | undefined; to: Date }

export function getDefaultDateFilters() {
  return {
    orderDate: { from: undefined as Date | undefined, to: new Date() },
    deliveryDate: { from: undefined as Date | undefined, to: new Date() },
  }
}

const AI_SORT_FIELD_MAP: Partial<Record<string, keyof Order>> = {
  order_date: 'orderDate',
  order_total: 'orderTotal',
  delivery_date: 'deliveryDate',
  order_status: 'orderStatus',
  order_number: 'orderNumber',
  order_type: 'orderType',
  customer: 'customer',
  sales_rep: 'salesRep',
}

function toIso(date: Date | undefined): string | undefined {
  return date?.toISOString().split('T')[0]
}

export type UseOrderFiltersParams = {
  searchTerm: string
  setSearchTerm: (value: string) => void
  dateFilters: {
    orderDate: DateFilter
    deliveryDate: DateFilter
  }
  setDateFilter: (filterId: 'orderDate' | 'deliveryDate', update: Partial<DateFilter>) => void
  selectedStatus: OrderStatus | undefined
  setSelectedStatus: (value: OrderStatus | undefined) => void
  salesRep: string | undefined
  setSalesRep: (v: string | undefined) => void
  customer: string | undefined
  setCustomer: (v: string | undefined) => void
  orderTotalMin: number | undefined
  setOrderTotalMin: (v: number | undefined) => void
  orderTotalMax: number | undefined
  setOrderTotalMax: (v: number | undefined) => void
  filterOptions: {
    salesReps: string[]
    customers: string[]
  }
  setPage: (page: number) => void
  setSort: (sort: SortState<Order>) => void
  setActiveFilterIds: (ids: Set<string>) => void
}

export function useOrderFilters({
  searchTerm, setSearchTerm,
  dateFilters, setDateFilter,
  selectedStatus, setSelectedStatus,
  salesRep, setSalesRep, customer, setCustomer,
  orderTotalMin, setOrderTotalMin, orderTotalMax, setOrderTotalMax,
  filterOptions, setPage,
  setSort, setActiveFilterIds,
}: UseOrderFiltersParams): FilterConfig[] {

  const { parseQuery, clearHistory, injectStateCorrection, hasHistory, isLoading: isAiLoading, error: aiError } = useAiSearch()

  const handleAiSearch = useCallback(async (query: string): Promise<void> => {
    const parsed = await parseQuery(query)
    const defaults = getDefaultDateFilters()
    const activateIds = new Set<string>()

    setSearchTerm(parsed.search ?? '')
    setSelectedStatus(parsed.status)

    setDateFilter('orderDate', {
      from: parsed.order_date_from ? new Date(`${parsed.order_date_from}T00:00:00`) : defaults.orderDate.from,
      to: parsed.order_date_to ? new Date(`${parsed.order_date_to}T00:00:00`) : defaults.orderDate.to,
    })
    setDateFilter('deliveryDate', {
      from: parsed.delivery_date_from ? new Date(`${parsed.delivery_date_from}T00:00:00`) : defaults.deliveryDate.from,
      to: parsed.delivery_date_to ? new Date(`${parsed.delivery_date_to}T00:00:00`) : defaults.deliveryDate.to,
    })

    if (parsed.order_date_from !== undefined || parsed.order_date_to !== undefined) activateIds.add('orderDate')
    if (parsed.status !== undefined) activateIds.add('status')
    if (parsed.delivery_date_from !== undefined || parsed.delivery_date_to !== undefined) activateIds.add('deliveryDate')
    if (parsed.sales_rep !== undefined) activateIds.add('salesRep')
    if (parsed.customer !== undefined) activateIds.add('customer')
    if (parsed.order_total_min !== undefined || parsed.order_total_max !== undefined) activateIds.add('orderTotal')

    setSalesRep(parsed.sales_rep)
    setCustomer(parsed.customer)
    setOrderTotalMin(parsed.order_total_min)
    setOrderTotalMax(parsed.order_total_max)
    activateIds.add('aiSearch')
    setActiveFilterIds(activateIds)

    const sortField = parsed.sort_by ? AI_SORT_FIELD_MAP[parsed.sort_by] : undefined
    setSort(sortField
      ? { field: sortField, order: parsed.sort_order ?? 'asc' }
      : { field: 'orderDate', order: 'desc' }
    )

    setPage(1)
  }, [parseQuery, setSearchTerm, setSelectedStatus, setDateFilter, setSalesRep, setCustomer, setOrderTotalMin, setOrderTotalMax, setActiveFilterIds, setSort, setPage])

  const buildCurrentParsedFilters = useCallback((overrides: Partial<ParsedFilters> = {}): ParsedFilters => ({
    search: searchTerm || undefined,
    status: selectedStatus,
    order_date_from: toIso(dateFilters.orderDate.from),
    order_date_to: dateFilters.orderDate.from !== undefined ? toIso(dateFilters.orderDate.to) : undefined,
    delivery_date_from: toIso(dateFilters.deliveryDate.from),
    delivery_date_to: dateFilters.deliveryDate.from !== undefined ? toIso(dateFilters.deliveryDate.to) : undefined,
    sales_rep: salesRep || undefined,
    customer: customer || undefined,
    ...overrides,
  }), [searchTerm, selectedStatus, dateFilters.orderDate, dateFilters.deliveryDate, salesRep, customer])

  return useMemo<FilterConfig[]>(() => [
    {
      type: 'aiSearch',
      id: 'aiSearch',
      onSearch: handleAiSearch,
      onClear: clearHistory,
      hasHistory,
      isLoading: isAiLoading,
      error: aiError,
      activeByDefault: true,
      active: true,
    },
    {
      type: 'search',
      id: 'search',
      value: searchTerm,
      onChange: (v) => {
        setSearchTerm(v)
        setPage(1)
        if (hasHistory) injectStateCorrection(buildCurrentParsedFilters({ search: v || undefined }))
      },
      onClear: () => { setSearchTerm(''); setPage(1) },
      placeholder: 'Search orders...',
      ariaLabel: 'Search orders',
    },
    {
      type: 'dateRange',
      id: 'orderDate',
      label: 'Order Date',
      value: dateFilters.orderDate,
      onChange: (update) => {
        setDateFilter('orderDate', update)
        if (hasHistory) {
          const newFrom = update.from !== undefined ? update.from : dateFilters.orderDate.from
          const newTo = update.to !== undefined ? update.to : dateFilters.orderDate.to
          injectStateCorrection(buildCurrentParsedFilters({
            order_date_from: toIso(newFrom),
            order_date_to: newFrom !== undefined ? toIso(newTo) : undefined,
          }))
        }
      },
      onClear: () => setDateFilter('orderDate', { from: undefined, to: new Date() }),
    },
    {
      type: 'dropdown',
      id: 'status',
      label: 'Order Status',
      options: orderStatuses,
      selectedValue: selectedStatus,
      onSelect: (value) => {
        setSelectedStatus(value as OrderStatus | undefined)
        setPage(1)
        if (hasHistory) injectStateCorrection(buildCurrentParsedFilters({ status: value as OrderStatus | undefined }))
      },
      onClear: () => { setSelectedStatus(undefined); setPage(1) },
      placeholderValue: 'Any',
    },
    {
      type: 'dateRange',
      id: 'deliveryDate',
      label: 'Delivery Date',
      value: dateFilters.deliveryDate,
      onChange: (update) => {
        setDateFilter('deliveryDate', update)
        if (hasHistory) {
          const newFrom = update.from !== undefined ? update.from : dateFilters.deliveryDate.from
          const newTo = update.to !== undefined ? update.to : dateFilters.deliveryDate.to
          injectStateCorrection(buildCurrentParsedFilters({
            delivery_date_from: toIso(newFrom),
            delivery_date_to: newFrom !== undefined ? toIso(newTo) : undefined,
          }))
        }
      },
      onClear: () => setDateFilter('deliveryDate', { from: undefined, to: new Date() }),
    },
    {
      type: 'dropdown',
      id: 'salesRep',
      label: 'Sales Rep',
      options: filterOptions.salesReps,
      selectedValue: salesRep,
      onSelect: (value) => {
        setSalesRep(value)
        if (hasHistory) injectStateCorrection(buildCurrentParsedFilters({ sales_rep: value }))
      },
      onClear: () => setSalesRep(undefined),
      placeholderValue: 'Any',
    },
    {
      type: 'dropdown',
      id: 'customer',
      label: 'Customer',
      options: filterOptions.customers,
      selectedValue: customer,
      onSelect: (value) => {
        setCustomer(value)
        if (hasHistory) injectStateCorrection(buildCurrentParsedFilters({ customer: value }))
      },
      onClear: () => setCustomer(undefined),
      placeholderValue: 'Any',
    },
    {
      type: 'range',
      id: 'orderTotal',
      label: 'Order Total',
      value: { from: orderTotalMin, to: orderTotalMax },
      onChange: (update) => {
        if ('from' in update) setOrderTotalMin(update.from)
        if ('to' in update) setOrderTotalMax(update.to)
        setPage(1)
      },
      onClear: () => { setOrderTotalMin(undefined); setOrderTotalMax(undefined); setPage(1) },
      active: true,
    },
  ], [
    filterOptions, searchTerm, dateFilters.orderDate, dateFilters.deliveryDate, selectedStatus, salesRep, customer,
    orderTotalMin, orderTotalMax,
    setSearchTerm, setSelectedStatus, setDateFilter, setSalesRep, setCustomer, setOrderTotalMin, setOrderTotalMax, setPage,
    handleAiSearch, clearHistory, hasHistory, isAiLoading, aiError, injectStateCorrection, buildCurrentParsedFilters,
  ])
}

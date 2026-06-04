import { useCallback, useState } from 'react'
import { useDebounce } from '../hooks/useDebounce'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faPrint, faEllipsis } from '@fortawesome/free-solid-svg-icons'
import { FilterBar } from '../components/FilterBar'
import { GridTable, type GridColumn, type SortState } from '../components/GridTable'
import { capitalizeWords, formattedDate, parseISODate } from '../utils/formatters'
import {
  useOrders,
  type Order,
  type OrderStatus,
} from '../hooks/useOrders'
import { PageHeader } from '../components/PageHeader'
import { useFilterOptions } from '../hooks/useFilterOptions'
import { useOrderFilters, getDefaultDateFilters } from '../hooks/useOrderFilters'

const orderTableColumns: readonly GridColumn<Order>[] = [
  {
    field: 'orderNumber',
    header: 'Order Number',
    customCell: (order) => (
      <div className="flex flex-col">
        <span>{order.orderNumber}</span>
        {order.exceptionType && (
          <span className="text-sm text-brand-500 dark:text-neutral-400">{order.exceptionType}</span>
        )}
      </div>
    ),
  },
  {
    field: 'customer',
    span: 2,
  },
  {
    field: 'orderDate',
    initialSortOrder: 'desc',
    valueFormatter: (value) => formattedDate(parseISODate(value as string)),
  },
  {
    field: 'orderTotal',
    align: 'right',
    valueFormatter: (value) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencySign: 'accounting' }).format(value as number),
  },
  {
    field: 'salesRep',
  },
  {
    field: 'deliveryDate',
    initialSortOrder: 'desc',
    valueFormatter: (value) => formattedDate(parseISODate(value as string)),
  },
  {
    field: 'orderStatus',
    header: 'Order Status',
    align: 'center',
    customCell: (order) => {
      return (
        <div className="flex justify-center">
          <span className={`w-full px-2 py-1 text-sm font-medium rounded-full ${statusColors[order.orderStatus]}`}>{capitalizeWords(order.orderStatus)}</span>
        </div>
      )
    },
  },
  {
    key: 'actions',
    customCell: () => <FontAwesomeIcon icon={faEllipsis} className="text-xl text-brand-500" />,
    align: 'center'
  },
]

const statusColors: Record<OrderStatus, string> = {
  pending:    'bg-yellow-500/15 text-yellow-800',
  approved:   'bg-blue-500/15 text-blue-800',
  processing: 'bg-blue-500/15 text-blue-800',
  shipped:    'bg-purple-500/15 text-purple-800',
  delivered:  'bg-green-500/15 text-green-800',
  completed:  'bg-green-500/15 text-green-800',
}

export function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilters, setDateFilters] = useState(getDefaultDateFilters)
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | undefined>()
  const [sort, setSort] = useState<SortState<Order>>({ field: 'orderDate', order: 'desc' })
  const [page, setPage] = useState(1)
  const [selectedSalesRep, setSelectedSalesRep] = useState<string | undefined>()
  const [selectedCustomer, setSelectedCustomer] = useState<string | undefined>()
  const [orderTotalMin, setOrderTotalMin] = useState<number | undefined>()
  const [orderTotalMax, setOrderTotalMax] = useState<number | undefined>()
  const [activeFilterIds, setActiveFilterIds] = useState<Set<string>>(() => new Set(['aiSearch']))
  // const [order]

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const { orders, isLoading, isFetching, error, totalPages } = useOrders({
    searchTerm: debouncedSearchTerm,
    orderDateFrom: dateFilters.orderDate.from,
    orderDateTo: dateFilters.orderDate.to,
    deliveryDateFrom: dateFilters.deliveryDate.from,
    deliveryDateTo: dateFilters.deliveryDate.to,
    selectedStatus,
    salesRep: selectedSalesRep,
    customer: selectedCustomer,
    orderTotalMin,
    orderTotalMax,
    sort,
    page,
  })

  const filterOptions = useFilterOptions()

  const handleSetSalesRep = useCallback((v: string | undefined) => { setSelectedSalesRep(v); setPage(1) }, [])
  const handleSetCustomer = useCallback((v: string | undefined) => { setSelectedCustomer(v); setPage(1) }, [])

  const setDateFilter = useCallback((key: keyof typeof dateFilters, update: Partial<{ from: Date | undefined; to: Date }>) => {
    setDateFilters((prev) => ({ ...prev, [key]: { ...prev[key], ...update } }))
    setPage(1)
  }, [])

  const handleSortValue = useCallback((s: SortState<Order>) => {
    setSort(s)
    setPage(1)
  }, [])

  const filters = useOrderFilters({
    searchTerm,
    setSearchTerm,
    dateFilters,
    setDateFilter,
    selectedStatus,
    setSelectedStatus,
    salesRep: selectedSalesRep,
    setSalesRep: handleSetSalesRep,
    customer: selectedCustomer,
    setCustomer: handleSetCustomer,
    orderTotalMin,
    setOrderTotalMin,
    orderTotalMax,
    setOrderTotalMax,
    filterOptions,
    setPage,
    setSort,
    setActiveFilterIds,
  })

  return (
    <section className="flex flex-col gap-5 h-dvh max-h-screen w-full">
      <PageHeader title="Sales Orders">
        {/* <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-brand-500 border-box px-3 py-2 text-sm text-white hover:bg-brand-600"
          >
            Add Order
          </button>
          <button
            type="button"
            className="button-outline"
          >
            <FontAwesomeIcon icon={faDownload} className="text-lg text-accent-800 dark:text-neutral-400" />
          </button>
          <button
            type="button"
            className="button-outline"
          >
            <FontAwesomeIcon icon={faPrint} className="text-lg text-accent-800 dark:text-neutral-400" />
          </button>
        </div> */}
      </PageHeader>

      <FilterBar
        filters={filters}
        activeFilterIds={activeFilterIds}
        onActiveFilterIdsChange={setActiveFilterIds}
      />

      <div className="flex-1 min-h-0 mt-1 mb-4">
          {error ? (
            <div className="border-t border-neutral-200 dark:border-neutral-700">
              <div className="px-4 py-8 text-center text-red-600 dark:text-red-400">{error}</div>
            </div>
          ) : isLoading ? (
            <div className="border-t border-neutral-200 dark:border-neutral-700">
              <div className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">Loading orders...</div>
            </div>
          ) : (
            <div className={`h-full transition-opacity duration-150 ${isFetching ? 'opacity-50' : 'opacity-100'}`}>
              <GridTable<Order>
                items={orders}
                columns={orderTableColumns}
                totalColumns={9}
                getRowKey={(order) => order.orderNumber}
                sort={sort}
                onSortChange={handleSortValue}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                emptyState={(
                  <div className="border-t border-neutral-200 dark:border-neutral-700">
                    <div className="px-4 py-8 text-center text-neutral-600 dark:text-neutral-400">
                      No orders match your filters.
                    </div>
                  </div>
                )}
              />
            </div>
          )}
      </div>
    </section>
  )
}

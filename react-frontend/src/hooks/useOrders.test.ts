import { renderHook, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useOrders } from './useOrders'

// Minimal valid params — override per test as needed
const defaultParams = {
  searchTerm: '',
  orderDateFrom: undefined,
  orderDateTo: undefined,
  deliveryDateFrom: undefined,
  deliveryDateTo: undefined,
  selectedStatus: undefined,
  salesRep: undefined,
  customer: undefined,
  orderTotalMin: undefined,
  orderTotalMax: undefined,
  warehouse: undefined,
  sort: { field: 'orderDate' as const, order: 'desc' as const },
  page: 1,
}

// A factory so individual tests only spell out what matters
function makeOrder(overrides = {}) {
  return {
    order_number: 'ORD-001',
    order_type: 'Standard',
    order_date: '2024-01-01',
    delivery_date: '2024-01-10',
    order_status: 'pending',
    order_total: 500,
    consignee: { name: 'Acme Corp' },
    sales_rep: { name: 'Jane Smith' },
    warehouse: { name: 'Main Warehouse' },
    ...overrides,
  }
}

function mockFetch(data = [makeOrder()], meta = { page: 1, per_page: 20, total_count: 1, total_pages: 3 }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data, meta }),
    }),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useOrders', () => {
  it('starts in a loading state', () => {
    mockFetch()
    const { result } = renderHook(() => useOrders(defaultParams))
    expect(result.current.isLoading).toBe(true)
  })

  it('returns mapped orders after a successful fetch', async () => {
    mockFetch([makeOrder({ order_number: 'ORD-123', consignee: { name: 'Beta LLC' } })])
    const { result } = renderHook(() => useOrders(defaultParams))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.orders).toHaveLength(1)
    expect(result.current.orders[0]).toMatchObject({ orderNumber: 'ORD-123', customer: 'Beta LLC' })
    expect(result.current.error).toBeNull()
  })

  it('exposes totalPages from the meta', async () => {
    mockFetch([], { page: 1, per_page: 20, total_count: 60, total_pages: 3 })
    const { result } = renderHook(() => useOrders(defaultParams))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.totalPages).toBe(3)
  })

  it('sets error and clears orders on a failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const { result } = renderHook(() => useOrders(defaultParams))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toMatch(/500/)
    expect(result.current.orders).toHaveLength(0)
  })

  it('appends orders on page > 1 instead of replacing', async () => {
    mockFetch([makeOrder({ order_number: 'ORD-001' })])
    const { result, rerender } = renderHook((props) => useOrders(props), {
      initialProps: defaultParams,
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch([makeOrder({ order_number: 'ORD-002' })])
    rerender({ ...defaultParams, page: 2 })
    await waitFor(() => expect(result.current.orders).toHaveLength(2))

    expect(result.current.orders.map((o) => o.orderNumber)).toEqual(['ORD-001', 'ORD-002'])
  })

  it('includes searchTerm in the query string', async () => {
    mockFetch()
    const fetchSpy = vi.mocked(fetch)
    const { result } = renderHook(() => useOrders({ ...defaultParams, searchTerm: 'Acme' }))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('search=Acme'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })
})

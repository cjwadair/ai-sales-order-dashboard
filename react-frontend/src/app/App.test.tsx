import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        // orders response
        data: [{
          order_number: 'ORD-1001',
          order_type: 'Standard',
          order_date: '2024-01-01',
          delivery_date: '2024-01-10',
          order_status: 'pending',
          order_total: 500,
          consignee: { name: 'Acme Corp' },
          sales_rep: { name: 'Jane Smith' },
        }],
        meta: { page: 1, per_page: 20, total_count: 1, total_pages: 1 },
        // filter_options response (same mock handles both URLs)
        sales_reps: [],
        customers: [],
      }),
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('App', () => {
  it('renders the orders page content on /orders route', async () => {
    mockFetch()
    render(
      <MemoryRouter initialEntries={['/orders']}>
        <App />q
      </MemoryRouter>,
    )

    expect(await screen.findByText('Sales Orders')).toBeInTheDocument()
    expect(await screen.findByText('ORD-1001')).toBeInTheDocument()
  })  
})
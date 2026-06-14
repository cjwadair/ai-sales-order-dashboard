import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ReportResultCard } from './ReportResultCard'
import type { ReportEnvelope } from '../api/reportEnvelope'

beforeAll(() => {
  class MockResizeObserver {
    private cb: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb
    }
    observe() {
      this.cb(
        [{ contentRect: { width: 600, height: 300 } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      )
    }
    unobserve = vi.fn()
    disconnect = vi.fn()
  }
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
})

afterEach(cleanup)

// Bar shape: 1 string dim + 1 decimal measure → recommends bar
const barEnvelope: ReportEnvelope = {
  spec: {},
  title: 'Sales by Rep',
  columns: [
    { name: 'rep_name', type: 'string' },
    { name: 'total_revenue', type: 'decimal' },
  ],
  data: [
    { rep_name: 'Alice', total_revenue: '12000.00' },
    { rep_name: 'Bob', total_revenue: '8500.00' },
  ],
  meta: { row_count: 2, truncated: false, unsupported_note: null },
}

// KPI shape: 1 row, 1 decimal measure, 0 dims → recommends kpi
const kpiEnvelope: ReportEnvelope = {
  spec: {},
  title: 'Total Revenue',
  columns: [{ name: 'revenue', type: 'decimal' }],
  data: [{ revenue: '99000.00' }],
  meta: { row_count: 1, truncated: false, unsupported_note: null },
}

// Table-only shape: 2 dims + 1 measure → validViews returns only ['table']
const tableOnlyEnvelope: ReportEnvelope = {
  spec: {},
  title: null,
  columns: [
    { name: 'region', type: 'string' },
    { name: 'product', type: 'string' },
    { name: 'revenue', type: 'decimal' },
  ],
  data: [{ region: 'North', product: 'Widget', revenue: '5000.00' }],
  meta: { row_count: 1, truncated: false, unsupported_note: null },
}

describe('ReportResultCard — recommended view', () => {
  it('renders the title when present', () => {
    render(<ReportResultCard envelope={barEnvelope} />)
    expect(screen.getByText('Sales by Rep')).toBeInTheDocument()
  })

  it('omits the title block when title is null', () => {
    render(<ReportResultCard envelope={tableOnlyEnvelope} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('defaults to bar view for bar-shaped data (bar button is pressed)', () => {
    render(<ReportResultCard envelope={barEnvelope} />)
    expect(screen.getByRole('button', { name: 'Bar' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders KPI big number for single-row single-measure data', () => {
    render(<ReportResultCard envelope={kpiEnvelope} />)
    expect(screen.getByText('99,000.00')).toBeInTheDocument()
  })
})

describe('ReportResultCard — view switcher', () => {
  it('shows bar, pie, and table options for small bar-shaped data', () => {
    render(<ReportResultCard envelope={barEnvelope} />)
    expect(screen.getByRole('button', { name: 'Bar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pie' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Table' })).toBeInTheDocument()
  })

  it('switches to table view and updates aria-pressed', () => {
    render(<ReportResultCard envelope={barEnvelope} />)
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(screen.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bar' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not show a switcher when only table is valid', () => {
    render(<ReportResultCard envelope={tableOnlyEnvelope} />)
    // No switcher buttons — the container should not render
    expect(screen.queryByRole('button', { name: 'Table' })).not.toBeInTheDocument()
  })
})

describe('ReportResultCard — footer notices', () => {
  it('shows unsupported_note when present', () => {
    const e: ReportEnvelope = {
      ...barEnvelope,
      meta: { ...barEnvelope.meta, unsupported_note: 'Inventory queries are not supported.' },
    }
    render(<ReportResultCard envelope={e} />)
    expect(screen.getByText(/Inventory queries are not supported/)).toBeInTheDocument()
  })

  it('does not show unsupported_note when null', () => {
    render(<ReportResultCard envelope={barEnvelope} />)
    expect(screen.queryByText(/Note:/)).not.toBeInTheDocument()
  })

  it('shows truncation notice when meta.truncated is true', () => {
    const e: ReportEnvelope = {
      ...barEnvelope,
      meta: { ...barEnvelope.meta, truncated: true, limit: 100 },
    }
    render(<ReportResultCard envelope={e} />)
    expect(screen.getByText(/Showing first 100 rows/)).toBeInTheDocument()
  })

  it('does not show truncation notice when not truncated', () => {
    render(<ReportResultCard envelope={barEnvelope} />)
    expect(screen.queryByText(/Showing first/)).not.toBeInTheDocument()
  })

  it('shows SQL debug summary when sql_debug is present', () => {
    const e: ReportEnvelope = {
      ...barEnvelope,
      meta: { ...barEnvelope.meta, sql_debug: 'SELECT rep_name, SUM(revenue) FROM orders' },
    }
    render(<ReportResultCard envelope={e} />)
    expect(screen.getByText('SQL debug')).toBeInTheDocument()
  })

  it('does not show SQL debug toggle when sql_debug is absent', () => {
    render(<ReportResultCard envelope={barEnvelope} />)
    expect(screen.queryByText('SQL debug')).not.toBeInTheDocument()
  })
})

describe('ReportResultCard — view source toggle', () => {
  it('raw JSON is hidden by default', () => {
    render(<ReportResultCard envelope={barEnvelope} />)
    expect(screen.queryByText(/"rep_name"/)).not.toBeInTheDocument()
  })

  it('shows raw JSON after clicking View source', () => {
    render(<ReportResultCard envelope={barEnvelope} />)
    fireEvent.click(screen.getByRole('button', { name: /View source/ }))
    expect(screen.getByText(/"rep_name"/)).toBeInTheDocument()
  })

  it('hides raw JSON again after clicking Hide source', () => {
    render(<ReportResultCard envelope={barEnvelope} />)
    fireEvent.click(screen.getByRole('button', { name: /View source/ }))
    fireEvent.click(screen.getByRole('button', { name: /Hide source/ }))
    expect(screen.queryByText(/"rep_name"/)).not.toBeInTheDocument()
  })
})

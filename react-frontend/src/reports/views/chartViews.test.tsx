import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BarView } from './BarView'
import { LineView } from './LineView'
import { PieView } from './PieView'
import type { ViewProps } from '../types'

// Recharts' ResponsiveContainer uses `new ResizeObserver(cb)` — must be a class constructor.
// Calling `observe()` fires the callback synchronously so the chart gets a 600×300 size.
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

const props: ViewProps = {
  title: 'Sales by Rep',
  columns: [
    { name: 'rep_name', type: 'string' },
    { name: 'total_revenue', type: 'decimal' },
  ],
  data: [
    { rep_name: 'Alice', total_revenue: '12345.67' },
    { rep_name: 'Bob', total_revenue: '9876.54' },
  ],
}

const noDataProps: ViewProps = { title: null, columns: props.columns, data: [] }

const measuresOnlyProps: ViewProps = {
  title: null,
  columns: [{ name: 'total_revenue', type: 'decimal' }],
  data: [{ total_revenue: '5000.00' }],
}

describe('BarView', () => {
  it('renders without crashing', () => {
    const { container } = render(<BarView {...props} />)
    expect(container.firstChild).not.toBeNull()
  })

  it('shows empty state when data is empty', () => {
    render(<BarView {...noDataProps} />)
    expect(screen.getByText('No rows matched')).toBeInTheDocument()
  })

  it('shows empty state when there is no dimension column', () => {
    render(<BarView {...measuresOnlyProps} />)
    expect(screen.getByText('No rows matched')).toBeInTheDocument()
  })

  it('renders formatted axis labels for dimension values', () => {
    render(<BarView {...props} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })
})

describe('LineView', () => {
  it('renders without crashing', () => {
    const { container } = render(<LineView {...props} />)
    expect(container.firstChild).not.toBeNull()
  })

  it('shows empty state when data is empty', () => {
    render(<LineView {...noDataProps} />)
    expect(screen.getByText('No rows matched')).toBeInTheDocument()
  })

  it('shows empty state when there is no dimension column', () => {
    render(<LineView {...measuresOnlyProps} />)
    expect(screen.getByText('No rows matched')).toBeInTheDocument()
  })

  it('renders formatted axis labels for dimension values', () => {
    render(<LineView {...props} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })
})

describe('PieView', () => {
  it('renders without crashing', () => {
    const { container } = render(<PieView {...props} />)
    expect(container.firstChild).not.toBeNull()
  })

  it('shows empty state when data is empty', () => {
    render(<PieView {...noDataProps} />)
    expect(screen.getByText('No rows matched')).toBeInTheDocument()
  })

  it('shows empty state when there is no measure column', () => {
    const dimOnlyProps: ViewProps = {
      title: null,
      columns: [{ name: 'rep_name', type: 'string' }],
      data: [{ rep_name: 'Alice' }],
    }
    render(<PieView {...dimOnlyProps} />)
    expect(screen.getByText('No rows matched')).toBeInTheDocument()
  })

  it('renders slice labels with dimension values', () => {
    render(<PieView {...props} />)
    // Pie labels contain dimension value + percentage e.g. "Alice (56%)"
    expect(screen.getByText(/Alice/)).toBeInTheDocument()
  })
})

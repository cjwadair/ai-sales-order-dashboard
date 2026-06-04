import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DateRangeFilter } from './DateRangeFilter'

afterEach(() => {
  cleanup()
})

const toDate = new Date(2026, 3, 18) // 18 Apr 2026

describe('DateRangeFilter', () => {
  it('renders label with "Any" when no from date is set', () => {
    render(
      <DateRangeFilter
        label="Order Date"
        value={{ from: undefined, to: toDate }}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Order Date: Any to 18 Apr 2026')).toBeInTheDocument()
  })

  it('renders label with from date when from date is set', () => {
    const fromDate = new Date(2026, 3, 1) // 01 Apr 2026

    render(
      <DateRangeFilter
        label="Order Date"
        value={{ from: fromDate, to: toDate }}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Order Date: 01 Apr 2026 to 18 Apr 2026')).toBeInTheDocument()
  })

  it('renders with a custom label', () => {
    render(
      <DateRangeFilter
        label="Delivery Date"
        value={{ from: undefined, to: toDate }}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Delivery Date: Any to 18 Apr 2026')).toBeInTheDocument()
  })

  it('calls onChange with from: undefined and today when "Clear range" is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <DateRangeFilter
        label="Order Date"
        value={{ from: new Date(2026, 3, 1), to: toDate }}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: /order date/i }))

    await user.click(screen.getByRole('button', { name: /clear range/i }))

    expect(onChange).toHaveBeenCalledOnce()
    const [update] = onChange.mock.calls[0]
    expect(update.from).toBeUndefined()
    expect(update.to).toBeInstanceOf(Date)
  })

  it('renders "From" and "To" section headings', async() => {
    render(
      <DateRangeFilter
        label="Order Date"
        value={{ from: undefined, to: toDate }}
        onChange={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /order date/i }))

    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()
  })

  it('disables days after "to" date in the From picker', async() => {
    const fromDate = new Date(2026, 3, 1) // 01 Apr 2026

    render(
      <DateRangeFilter
        label="Order Date"
        value={{ from: fromDate, to: toDate }}
        onChange={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /order date/i }))

    // Days after toDate (18 Apr) should be disabled in the From calendar
    const fromSection = screen.getByText('From').closest('div')!.parentElement!
    const disabledButtons = fromSection.querySelectorAll('button:disabled')
    expect(disabledButtons.length).toBeGreaterThan(0)
  })

  it('disables days before "from" date in the To picker', async () => {
    const user = userEvent.setup()
    const fromDate = new Date(2026, 3, 10) // 10 Apr 2026

    render(
      <DateRangeFilter
        label="Order Date"
        value={{ from: fromDate, to: toDate }}
        onChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /order date/i }))

    // Days before fromDate (10 Apr) should be disabled in the To calendar
    const toSection = screen.getByText('To').closest('div')!.parentElement!
    const disabledButtons = toSection.querySelectorAll('button:disabled')
    expect(disabledButtons.length).toBeGreaterThan(0)
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilterBar, type FilterConfig } from './FilterBar'

afterEach(() => {
  cleanup()
})

const salesRepFilter: FilterConfig = {
  type: 'dropdown',
  id: 'salesRep',
  label: 'Sales Rep',
  options: ['Jordan Lee', 'Taylor Kim'],
  selectedValue: undefined,
  onSelect: vi.fn(),
  onClear: vi.fn(),
}

describe('FilterBar', () => {
  it('renders a search filter that starts active', () => {
    render(<FilterBar filters={[{ type: 'search', id: 'search', value: '', onChange: vi.fn(), onClear: vi.fn(), active: true }]} />)

    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('renders a dropdown filter that starts active', () => {
    render(
      <FilterBar
        filters={[{
          type: 'dropdown',
          id: 'status',
          label: 'Order Status',
          options: ['Pending', 'Shipped'],
          selectedValue: undefined,
          onSelect: vi.fn(),
          onClear: vi.fn(),
          active: true,
        }]}
      />,
    )

    expect(screen.getByText('Order Status: Any')).toBeInTheDocument()
  })

  it('activates inactive filters from the Add Filter menu', async () => {
    const user = userEvent.setup()

    render(<FilterBar filters={[salesRepFilter]} />)

    await user.click(screen.getByText('Filter'))
    await user.click(screen.getByRole('option', { name: 'Sales Rep' }))

    expect(screen.getByText('Sales Rep: Any')).toBeInTheDocument()
  })

  it('removes a filter from the bar when its value is cleared', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()

    render(
      <FilterBar
        filters={[{
          type: 'dropdown',
          id: 'salesRep',
          label: 'Sales Rep',
          options: ['Jordan Lee', 'Taylor Kim'],
          selectedValue: 'Jordan Lee',
          onSelect: vi.fn(),
          onClear,
          active: true,
          placeholderValue: 'Any',
        }]}
      />,
    )

    await user.click(screen.getByText('Sales Rep: Jordan Lee'))
    await user.click(screen.getByRole('button', { name: 'Any Sales Rep' }))

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Sales Rep: Jordan Lee')).not.toBeInTheDocument()
    expect(screen.queryByText('Sales Rep: Any')).not.toBeInTheDocument()
  })

  it('hides Add Filter button when no non-aiSearch filters are configured', () => {
    render(<FilterBar filters={[]} />)

    expect(screen.queryByText('Filter')).not.toBeInTheDocument()
  })

  it('hides clear filters control when no filter has a value', () => {
    render(<FilterBar filters={[{ type: 'search', id: 'search', value: '', onChange: vi.fn(), onClear: vi.fn(), active: true }]} />)

    expect(screen.queryByRole('button', { name: 'Clear Filters' })).not.toBeInTheDocument()
  })

  it('shows clear filters control when a filter has a value', () => {
    render(<FilterBar filters={[{ type: 'search', id: 'search', value: 'acme', onChange: vi.fn(), onClear: vi.fn(), active: true }]} />)

    expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument()
  })

  it('calls onClear on all active filters when clear filters is clicked', async () => {
    const user = userEvent.setup()
    const onClearSearch = vi.fn()
    const onClearDropdown = vi.fn()

    render(
      <FilterBar
        filters={[
          { type: 'search', id: 'search', value: 'acme', onChange: vi.fn(), onClear: onClearSearch, active: true },
          {
            type: 'dropdown',
            id: 'salesRep',
            label: 'Sales Rep',
            options: ['Jordan Lee', 'Taylor Kim'],
            selectedValue: 'Jordan Lee',
            onSelect: vi.fn(),
            onClear: onClearDropdown,
            active: true,
          },
        ]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Clear Filters' }))

    expect(onClearSearch).toHaveBeenCalledTimes(1)
    expect(onClearDropdown).toHaveBeenCalledTimes(1)
  })

  describe('activeByDefault', () => {
    it('keeps an activeByDefault filter visible after its value is individually cleared', async () => {
      const user = userEvent.setup()
      const onClear = vi.fn()

      render(
        <FilterBar
          filters={[{
            type: 'dropdown',
            id: 'salesRep',
            label: 'Sales Rep',
            options: ['Jordan Lee', 'Taylor Kim'],
            selectedValue: 'Jordan Lee',
            onSelect: vi.fn(),
            onClear,
            active: true,
            activeByDefault: true,
            placeholderValue: 'Any',
          }]}
        />,
      )

      await user.click(screen.getByText('Sales Rep: Jordan Lee'))
      await user.click(screen.getByRole('button', { name: 'Any Sales Rep' }))

      expect(onClear).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Sales Rep: Jordan Lee')).toBeInTheDocument()
    })

    it('keeps activeByDefault filters visible when Clear Filters is clicked', async () => {
      const user = userEvent.setup()
      const onClearSearch = vi.fn()
      const onClearDropdown = vi.fn()

      render(
        <FilterBar
          filters={[
            { type: 'search', id: 'search', value: 'acme', onChange: vi.fn(), onClear: onClearSearch, active: true },
            {
              type: 'dropdown',
              id: 'salesRep',
              label: 'Sales Rep',
              options: ['Jordan Lee', 'Taylor Kim'],
              selectedValue: 'Jordan Lee',
              onSelect: vi.fn(),
              onClear: onClearDropdown,
              active: true,
              activeByDefault: true,
            },
          ]}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Clear Filters' }))

      expect(onClearSearch).toHaveBeenCalledTimes(1)
      expect(onClearDropdown).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
      expect(screen.getByText('Sales Rep: Jordan Lee')).toBeInTheDocument()
    })

    it('keeps an activeByDefault search filter visible when its value is cleared', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()

      render(
        <FilterBar
          filters={[{ type: 'search', id: 'search', value: 'acme', onChange, onClear: vi.fn(), active: true, activeByDefault: true }]}
        />,
      )

      const input = screen.getByRole('searchbox')
      await user.clear(input)

      expect(onChange).toHaveBeenLastCalledWith('')
      expect(screen.getByRole('searchbox')).toBeInTheDocument()
    })
  })

  it('does not call onClear on inactive filters when clear filters is clicked', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()

    render(
      <FilterBar
        filters={[
          { type: 'search', id: 'search', value: 'acme', onChange: vi.fn(), onClear: vi.fn(), active: true },
          {
            type: 'dropdown',
            id: 'salesRep',
            label: 'Sales Rep',
            options: ['Jordan Lee', 'Taylor Kim'],
            selectedValue: undefined,
            onSelect: vi.fn(),
            onClear,
          },
        ]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Clear Filters' }))

    expect(onClear).not.toHaveBeenCalled()
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AddFilterButton } from './AddFilterButton'

afterEach(() => {
  cleanup()
})

describe('AddFilterButton', () => {
  it('shows only inactive filter options', async () => {
    const user = userEvent.setup()

    render(
      <AddFilterButton
        filters={[
          { id: 'deliveryDate', label: 'Delivery Date' },
          { id: 'salesRep', label: 'Sales Rep' },
        ]}
        activeFilterIds={new Set(['deliveryDate'])}
        onActivateFilter={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Filter' }))

    expect(screen.queryByRole('option', { name: 'Delivery Date' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Sales Rep' })).toBeInTheDocument()
  })

  it('calls onActivateFilter with selected filter id and closes menu', async () => {
    const user = userEvent.setup()
    const onActivateFilter = vi.fn()

    render(
      <AddFilterButton
        filters={[
          { id: 'deliveryDate', label: 'Delivery Date' },
          { id: 'salesRep', label: 'Sales Rep' },
        ]}
        activeFilterIds={new Set()}
        onActivateFilter={onActivateFilter}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('option', { name: 'Sales Rep' }))

    expect(onActivateFilter).toHaveBeenCalledWith('salesRep')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes when clicking outside', async () => {
    const user = userEvent.setup()

    render(
      <div>
        <AddFilterButton
          filters={[{ id: 'deliveryDate', label: 'Delivery Date' }]}
          activeFilterIds={new Set()}
          onActivateFilter={vi.fn()}
        />
        <button type="button">Outside</button>
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'Filter' }))

    expect(screen.getByRole('option', { name: 'Delivery Date' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Outside' }))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

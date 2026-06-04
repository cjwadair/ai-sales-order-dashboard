import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SearchInput } from './SearchInput'

afterEach(() => {
  cleanup()
})

describe('SearchInput', () => {
  it('renders a controlled search input value', () => {
    render(<SearchInput value="Acme" onChange={vi.fn()} placeholder="Search orders..." />)

    expect(screen.getByRole('searchbox', { name: 'Search orders...' })).toHaveValue('Acme')
  })

  it('calls onChange with the updated value when typing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<SearchInput value="" onChange={onChange} placeholder="Search orders..." />)

    await user.type(screen.getByRole('searchbox', { name: 'Search orders...' }), 'ORD')

    expect(onChange).toHaveBeenNthCalledWith(1, 'O')
    expect(onChange).toHaveBeenNthCalledWith(2, 'R')
    expect(onChange).toHaveBeenNthCalledWith(3, 'D')
  })

  it('prefers an explicit aria label over the placeholder', () => {
    render(
      <SearchInput
        value=""
        onChange={vi.fn()}
        placeholder="Search orders..."
        ariaLabel="Search sales orders"
      />,
    )

    expect(screen.getByRole('searchbox', { name: 'Search sales orders' })).toBeInTheDocument()
  })

  it('supports custom container and input classes', () => {
    render(
      <SearchInput
        value=""
        onChange={vi.fn()}
        className="toolbar-search"
        inputClassName="toolbar-search-input"
      />,
    )

    expect(screen.getByRole('searchbox', { name: 'Search...' })).toHaveClass('toolbar-search-input')
    expect(screen.getByRole('searchbox', { name: 'Search...' }).parentElement).toHaveClass('toolbar-search')
  })
})
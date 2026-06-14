import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiSearchBar } from './AiSearchBar'


describe('AiSearchBar', () => {
  beforeEach(() => {
    cleanup()
  })
  
  afterEach(() => {
    cleanup()
  })

  it('renders input and handles search', async () => {
    const onSearch = vi.fn()
    
    render(
      <AiSearchBar
        onSearch={onSearch}
        isLoading={false}
        error={null}
      />
    )

    const input = screen.getByRole('textbox', { name: /AI search/i })
    expect(input).toBeInTheDocument()

    await userEvent.type(input, 'show completed orders for the last 30 days')
    await userEvent.type(input, '{enter}')

    expect(onSearch).toHaveBeenCalledTimes(1)

    expect(onSearch).toHaveBeenCalledWith('show completed orders for the last 30 days')
  })

  it('disables input when loading', () => {
    render(
      <AiSearchBar
        onSearch={vi.fn()}
        isLoading={true}
        error={null}
      />
    )

    const input = screen.getByRole('textbox', { name: /AI search/i })
    expect(input).toBeDisabled()
  })

  it('shows error message', () => {
    render(
      <AiSearchBar
        onSearch={vi.fn()}
        isLoading={false}
        error="Something went wrong"
      />
    )

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
  })
})
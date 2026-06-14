import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ErrorResultCard } from './ErrorResultCard'

afterEach(cleanup)

describe('ErrorResultCard', () => {
  it('displays the error message', () => {
    render(<ErrorResultCard message="Request failed: 400" code={null} details={[]} />)
    expect(screen.getByText('Request failed: 400')).toBeInTheDocument()
  })

  it('has an accessible alert role', () => {
    render(<ErrorResultCard message="Error" code={null} details={[]} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows timeout hint for timeout code', () => {
    render(<ErrorResultCard message="Request timed out" code="timeout" details={[]} />)
    expect(screen.getByText(/narrowing the date range/)).toBeInTheDocument()
  })

  it('shows server error hint for upstream_error', () => {
    render(<ErrorResultCard message="Upstream error" code="upstream_error" details={[]} />)
    expect(screen.getByText(/Something went wrong on the server/)).toBeInTheDocument()
  })

  it('shows server error hint for internal code', () => {
    render(<ErrorResultCard message="Internal error" code="internal" details={[]} />)
    expect(screen.getByText(/Something went wrong on the server/)).toBeInTheDocument()
  })

  it('shows validation details list for validation_failed', () => {
    render(
      <ErrorResultCard
        message="Validation failed"
        code="validation_failed"
        details={['Unknown field: region', 'Invalid date range']}
      />,
    )
    expect(screen.getByText('Unknown field: region')).toBeInTheDocument()
    expect(screen.getByText('Invalid date range')).toBeInTheDocument()
  })

  it('shows no hint for bad_request or null code', () => {
    render(<ErrorResultCard message="Bad request" code="bad_request" details={[]} />)
    expect(screen.queryByText(/narrowing the date range/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Something went wrong on the server/)).not.toBeInTheDocument()
  })

  it('renders nothing extra when details is empty', () => {
    render(<ErrorResultCard message="Oops" code={null} details={[]} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

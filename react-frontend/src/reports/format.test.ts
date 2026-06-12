import { describe, expect, it } from 'vitest'
import { formatColumnName, formatDecimal, formatDate, formatValue } from './format'

describe('formatColumnName', () => {
  it('converts snake_case to Title Case', () => {
    expect(formatColumnName('order_date')).toBe('Order Date')
    expect(formatColumnName('rep_name')).toBe('Rep Name')
  })

  it('converts camelCase to Title Case', () => {
    expect(formatColumnName('repName')).toBe('Rep Name')
  })

  it('capitalises a single word', () => {
    expect(formatColumnName('revenue')).toBe('Revenue')
  })
})

describe('formatDecimal', () => {
  it('adds thousands separators', () => {
    expect(formatDecimal('1234567.89')).toBe('1,234,567.89')
  })

  it('preserves all decimal digits without floating-point rounding', () => {
    expect(formatDecimal('9007199254740993.99')).toBe('9,007,199,254,740,993.99')
  })

  it('handles negative values', () => {
    expect(formatDecimal('-1234.50')).toBe('-1,234.50')
  })

  it('handles whole-number strings (no decimal point)', () => {
    expect(formatDecimal('100')).toBe('100')
  })

  it('handles zero', () => {
    expect(formatDecimal('0')).toBe('0')
    expect(formatDecimal('0.00')).toBe('0.00')
  })
})

describe('formatDate', () => {
  it('formats an ISO date string to a readable date', () => {
    expect(formatDate('2026-01-15')).toBe('Jan 15, 2026')
  })

  it('returns the original string when the input is not a valid ISO date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })
})

describe('formatValue', () => {
  it('dispatches decimal strings through formatDecimal', () => {
    expect(formatValue('1234.56', 'decimal')).toBe('1,234.56')
  })

  it('dispatches integer values with grouping', () => {
    expect(formatValue(1234567, 'integer')).toBe('1,234,567')
    expect(formatValue('42', 'integer')).toBe('42')
  })

  it('dispatches date strings through formatDate', () => {
    expect(formatValue('2026-06-01', 'date')).toBe('Jun 1, 2026')
  })

  it('passes string and enum values through unchanged', () => {
    expect(formatValue('Alice', 'string')).toBe('Alice')
    expect(formatValue('approved', 'enum')).toBe('approved')
  })

  it('returns an empty string for null', () => {
    expect(formatValue(null, 'string')).toBe('')
  })
})

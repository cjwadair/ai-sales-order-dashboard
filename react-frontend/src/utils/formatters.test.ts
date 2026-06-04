import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pluralizeWord, capitalizeWords, formattedDate, parseISODate  } from './formatters'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('pluralizeWord', () => {
  it('pluralizes regular words', () => {
    expect(pluralizeWord('cat')).toBe('cats')
    expect(pluralizeWord('dog')).toBe('dogs')
  })

  it('pluralizes words ending in s', () => {
    expect(pluralizeWord('bus')).toBe('buses')
    expect(pluralizeWord('class')).toBe('classes')
  })

  it('pluralizes words ending in y preceded by a consonant', () => {
    expect(pluralizeWord('city')).toBe('cities')
    expect(pluralizeWord('baby')).toBe('babies')
  })

  it('does not pluralize words ending in y preceded by a vowel', () => {
    expect(pluralizeWord('key')).toBe('keys')
    expect(pluralizeWord('day')).toBe('days')
  })
})

describe('capitalizeWord', () => {
  it('capitalizes each word in a string', () => {
    expect(capitalizeWords('hello world')).toBe('Hello World')
    expect(capitalizeWords('react frontend')).toBe('React Frontend')
  })

  it('handles multiple spaces correctly', () => {
    expect(capitalizeWords('  hello   world  ')).toBe('  Hello   World  ')
  })

  it('handles empty strings', () => {
    expect(capitalizeWords('')).toBe('')
  })
})

describe('formattedDate', () => {
  it('formats a date as "DD MMM YYYY"', () => {
    const date = new Date(2024, 0, 5) // January 5, 2024
    expect(formattedDate(date)).toBe('05 Jan 2024')
  })

  it('pads single-digit days with a leading zero', () => {
    const date = new Date(2024, 0, 9) // January 9, 2024
    expect(formattedDate(date)).toBe('09 Jan 2024')
  })
})

describe('parseISODate', () => {
  it('parses an ISO date string into a Date object', () => {
    const dateStr = '2024-01-15'
    const date = parseISODate(dateStr)
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(0) // Months are zero-indexed
    expect(date.getDate()).toBe(15)
  })

  it('handles invalid date strings gracefully', () => {
    const dateStr = 'invalid-date'
    const date = parseISODate(dateStr)
    expect(isNaN(date.getTime())).toBe(true) // Invalid dates should result in NaN time
  })

  it('non ISO formats should not be parsed correctly', () => {
    const dateStr = '01/15/2024'
    const date = parseISODate(dateStr)
    expect(isNaN(date.getTime())).toBe(true) // Non-ISO formats should not be parsed
  })
}) 



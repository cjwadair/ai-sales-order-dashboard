import type { ColumnType } from '../api/reportEnvelope'
import { capitalizeWords, parseISODate } from '../utils/formatters'

export function formatColumnName(name: string): string {
  return capitalizeWords(
    name.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'),
  )
}

// Formats a decimal string with thousands grouping, preserving all decimal digits
// exactly as they appear in the source — never routes through a JS float.
export function formatDecimal(value: string): string {
  const neg = value.startsWith('-')
  const abs = neg ? value.slice(1) : value
  const dotIndex = abs.indexOf('.')
  const intPart = dotIndex >= 0 ? abs.slice(0, dotIndex) : abs
  const decPart = dotIndex >= 0 ? abs.slice(dotIndex + 1) : undefined

  const formattedInt = new Intl.NumberFormat('en-US').format(BigInt(intPart || '0'))
  const result = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt
  return neg ? `-${result}` : result
}

export function formatDate(iso: string): string {
  const parts = iso.split('-').map(Number)
  if (parts.length < 3 || parts.some(isNaN)) return iso
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(parseISODate(iso))
}

export function formatValue(value: string | number | null, type: ColumnType): string {
  if (value === null || value === undefined) return ''

  switch (type) {
    case 'decimal':
      return formatDecimal(String(value))
    case 'integer': {
      const n = typeof value === 'number' ? value : parseInt(value, 10)
      return Number.isNaN(n) ? String(value) : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
    }
    case 'date':
      return typeof value === 'string' ? formatDate(value) : String(value)
    case 'string':
    case 'enum':
    default:
      return String(value)
  }
}

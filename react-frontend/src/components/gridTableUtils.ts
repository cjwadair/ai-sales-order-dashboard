import type { GridColumn } from './GridTable'

type SpanValidationResult = {
  valid: boolean
  spanTotal: number
}

function getColumnSpan<TItem = unknown>(column: GridColumn<TItem>) {
  return column.span ?? 1
}

export function getSpanTotal<TItem = unknown>(columns: readonly GridColumn<TItem>[]) {
  return columns.reduce((sum, column) => sum + getColumnSpan(column), 0)
}

export function validateColumnSpans<TItem = unknown>(columns: readonly GridColumn<TItem>[], totalColumns: number): SpanValidationResult {
  const spanTotal = getSpanTotal(columns)

  return {
    valid: spanTotal === totalColumns,
    spanTotal,
  }
}

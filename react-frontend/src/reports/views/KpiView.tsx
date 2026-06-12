import { formatValue, formatColumnName } from '../format'
import type { ViewProps } from '../types'

export function KpiView({ data, columns }: ViewProps) {
  const measureCol = columns.find(c => c.type === 'decimal' || c.type === 'integer')
  if (!measureCol || data.length === 0) {
    return <div className="py-8 text-center text-sm text-neutral-500">No data available.</div>
  }

  const value = data[0][measureCol.name]
  const formatted = formatValue(value, measureCol.type)

  return (
    <div className="flex flex-col items-center py-10 gap-3">
      <div className="text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
        {formatted}
      </div>
      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
        {formatColumnName(measureCol.name)}
      </div>
    </div>
  )
}

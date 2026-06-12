import { formatValue } from '../format'
import type { ViewProps } from '../types'

export function ListView({ data, columns }: ViewProps) {
  const col = columns[0]
  if (!col || data.length === 0) {
    return <div className="py-8 text-center text-sm text-neutral-500">No data available.</div>
  }

  return (
    <ul className="w-full divide-y divide-neutral-200 dark:divide-neutral-700">
      {data.map((row, i) => (
        <li key={i} className="px-4 py-2 text-sm text-neutral-800 dark:text-neutral-200">
          {formatValue(row[col.name], col.type)}
        </li>
      ))}
    </ul>
  )
}

import { formatValue, formatColumnName } from '../format'
import type { ReportRow, ReportColumn } from '../../api/reportEnvelope'
import type { ViewProps } from '../types'
import clsx from 'clsx'

function isMeasure(col: ReportColumn): boolean {
  return col.type === 'decimal' || col.type === 'integer'
}

function sumColumn(data: ReportRow[], colName: string): number {
  return data.reduce((acc, row) => {
    const v = row[colName]
    if (v === null || v === undefined) return acc
    const n = typeof v === 'number' ? v : parseFloat(String(v))
    return acc + (Number.isFinite(n) ? n : 0)
  }, 0)
}

function formatTotal(sum: number, col: ReportColumn): string {
  if (col.type === 'integer') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(sum)
  }
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(sum)
}

export function SummaryTableView({ data, columns }: ViewProps) {
  if (columns.length === 0) {
    return <div className="py-8 text-center text-sm text-neutral-500">No columns available.</div>
  }

  const dims = columns.filter(c => !isMeasure(c))
  const measures = columns.filter(c => isMeasure(c))
  // Reorder: dimension columns first, then measure columns
  const allCols = [...dims, ...measures].slice(0, 12)
  const hasTotals = measures.length > 0 && data.length > 0
  const n = allCols.length
  const gridStyle = { display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }

  return (
    <div className="w-full h-full overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900">
      {/* Header */}
      <div
        style={gridStyle}
        className="bg-accent-100 dark:bg-neutral-800 border-b border-accent-200 dark:border-neutral-700"
      >
        {allCols.map(col => (
          <div
            key={col.name}
            className={clsx(
              'px-4 py-3 text-xs font-medium text-accent-800 dark:text-neutral-300',
              isMeasure(col) ? 'text-right' : 'text-left',
            )}
          >
            {formatColumnName(col.name)}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {data.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No data available.
        </div>
      ) : (
        <div className="h-full min-h-0 overflow-y-auto">
          {data.map((row, i) => (
            <div
              key={i}
              style={gridStyle}
              className="border-t border-neutral-200 dark:border-neutral-700"
            >
              {allCols.map(col => (
                <div
                  key={col.name}
                  className={clsx(
                    'px-4 py-3 text-sm text-neutral-800 dark:text-neutral-300',
                    isMeasure(col) ? 'text-right' : 'text-left',
                  )}
                >
                  {formatValue(row[col.name] as string | number | null, col.type)}
                </div>
              ))}
            </div>
          ))}

          {/* Totals row */}
          {hasTotals && (
            <div
              style={gridStyle}
              className="border-t-2 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800"
            >
              {allCols.map((col, i) => (
                <div
                  key={col.name}
                  className={clsx(
                    'px-4 py-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100',
                    isMeasure(col) ? 'text-right' : 'text-left',
                  )}
                >
                  {isMeasure(col)
                    ? formatTotal(sumColumn(data, col.name), col)
                    : i === 0 ? 'Total' : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

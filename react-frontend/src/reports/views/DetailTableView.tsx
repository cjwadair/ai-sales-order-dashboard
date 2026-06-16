import { GridTable, type GridColumn } from '../../components/GridTable'
import { formatValue, formatColumnName } from '../format'
import type { ReportRow, ReportColumn } from '../../api/reportEnvelope'
import type { ViewProps } from '../types'
import clsx from 'clsx'

const CONTAINER = 'w-full overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900'

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-500/15 text-yellow-800 dark:text-yellow-300',
  approved:   'bg-blue-500/15 text-blue-800 dark:text-blue-300',
  processing: 'bg-blue-500/15 text-blue-800 dark:text-blue-300',
  shipped:    'bg-purple-500/15 text-purple-800 dark:text-purple-300',
  delivered:  'bg-green-500/15 text-green-800 dark:text-green-300',
  completed:  'bg-green-500/15 text-green-800 dark:text-green-300',
  cancelled:  'bg-red-500/15 text-red-800 dark:text-red-300',
}

function isStatusColumn(col: ReportColumn): boolean {
  return col.name.includes('status') && (col.type === 'string' || col.type === 'enum')
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const color = STATUS_COLORS[normalized] ?? 'bg-neutral-500/15 text-neutral-700 dark:text-neutral-300'
  return (
    <span className={clsx('inline-block px-2 py-0.5 text-xs font-medium rounded-full capitalize', color)}>
      {value}
    </span>
  )
}

function buildColumn(col: ReportColumn, isFirst: boolean): GridColumn<ReportRow> {
  const isMeasure = col.type === 'decimal' || col.type === 'integer'

  if (isStatusColumn(col)) {
    return {
      field: col.name,
      header: formatColumnName(col.name),
      align: 'center',
      customCell: (row) => {
        const val = row[col.name]
        if (val === null || val === undefined) return null
        return <StatusBadge value={String(val)} />
      },
    }
  }

  return {
    field: col.name,
    header: formatColumnName(col.name),
    align: isMeasure ? 'right' : 'left',
    cellClassName: isFirst ? 'font-medium' : undefined,
    valueFormatter: (value) => formatValue(value as string | number | null, col.type),
  }
}

export function DetailTableView({ data, columns }: ViewProps) {
  if (columns.length === 0) {
    return <div className="py-8 text-center text-sm text-neutral-500">No columns available.</div>
  }

  const visibleCols = columns.slice(0, 12)
  const gridColumns: GridColumn<ReportRow>[] = visibleCols.map((col, i) => buildColumn(col, i === 0))

  return (
    <GridTable
      items={data}
      columns={gridColumns}
      totalColumns={visibleCols.length}
      getRowKey={(_, i) => String(i)}
      containerClassName={CONTAINER}
      bodyClassName="flex flex-col w-full text-left text-sm"
    />
  )
}

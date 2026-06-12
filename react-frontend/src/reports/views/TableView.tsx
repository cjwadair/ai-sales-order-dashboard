import { GridTable, type GridColumn } from '../../components/GridTable'
import { formatValue, formatColumnName } from '../format'
import type { ReportRow } from '../../api/reportEnvelope'
import type { ViewProps } from '../types'

const CONTAINER = 'w-full overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900'
const MAX_COLUMNS = 12

export function TableView({ data, columns }: ViewProps) {
  if (columns.length === 0) {
    return <div className="py-8 text-center text-sm text-neutral-500">No columns available.</div>
  }

  const visibleColumns = columns.slice(0, MAX_COLUMNS)
  const totalColumns = visibleColumns.length

  const gridColumns: GridColumn<ReportRow>[] = visibleColumns.map(col => ({
    field: col.name,
    header: formatColumnName(col.name),
    align: col.type === 'decimal' || col.type === 'integer' ? 'right' : 'left',
    valueFormatter: (value) => formatValue(value as string | number | null, col.type),
  }))

  return (
    <GridTable
      items={data}
      columns={gridColumns}
      totalColumns={totalColumns}
      getRowKey={(_, index) => String(index)}
      containerClassName={CONTAINER}
      bodyClassName="flex flex-col w-full text-left text-sm"
    />
  )
}

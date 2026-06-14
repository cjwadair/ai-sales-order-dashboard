import { useState } from 'react'
import clsx from 'clsx'
import { viewRegistry } from './viewRegistry'
import type { ViewType } from './types'
import { recommendView } from './recommendView'
import type { ReportEnvelope, ReportColumn, ReportRow } from '../api/reportEnvelope'

const VIEW_LABELS: Record<ViewType, string> = {
  table: 'Table',
  bar: 'Bar',
  line: 'Line',
  pie: 'Pie',
  kpi: 'KPI',
  list: 'List',
}

function isMeasure(col: ReportColumn): boolean {
  return col.type === 'decimal' || col.type === 'integer'
}

// Returns the ordered list of views valid for this data shape. Table is always included.
// Pie is a manual-only alternative: offered when data fits a bar shape with ≤8 rows × 1 measure.
function validViews(columns: ReportColumn[], data: ReportRow[]): ViewType[] {
  const measures = columns.filter(isMeasure)
  const dims = columns.filter(c => !isMeasure(c))
  const hasDateDim = dims.some(c => c.type === 'date')
  const catDimCount = dims.filter(c => c.type === 'string' || c.type === 'enum').length

  const views: ViewType[] = []

  if (data.length === 1 && measures.length === 1 && dims.length === 0) views.push('kpi')
  if (hasDateDim && measures.length >= 1) views.push('line')
  if (catDimCount === 1 && dims.length === 1 && measures.length >= 1) views.push('bar')
  if (catDimCount === 1 && dims.length === 1 && measures.length === 1 && data.length <= 8) views.push('pie')
  if (dims.length === 1 && measures.length === 0) views.push('list')
  views.push('table')

  return views
}

type ReportResultCardProps = {
  envelope: ReportEnvelope
}

export function ReportResultCard({ envelope }: ReportResultCardProps) {
  const { title, data, columns, meta } = envelope
  const options = validViews(columns, data)
  const [activeView, setActiveView] = useState<ViewType>(() => recommendView(columns, data))
  const [showSource, setShowSource] = useState(false)

  const effectiveView: ViewType = options.includes(activeView) ? activeView : options[0]
  const ViewComponent = viewRegistry[effectiveView]

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
      {title && (
        <div className="px-5 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
        </div>
      )}

      {options.length > 1 && (
        <div className="flex items-center gap-1 px-5 pt-3 pb-1">
          {options.map(view => (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              aria-pressed={effectiveView === view}
              className={clsx(
                'px-3 py-1 rounded text-xs font-medium transition-colors',
                effectiveView === view
                  ? 'bg-brand-600 text-white'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800',
              )}
            >
              {VIEW_LABELS[view]}
            </button>
          ))}
        </div>
      )}

      <div className="px-5 py-4">
        <ViewComponent data={data} columns={columns} title={title} />
      </div>

      <div className="px-5 pb-4 flex flex-col gap-2">
        {meta.unsupported_note && (
          <div className="rounded bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            Note: {meta.unsupported_note}
          </div>
        )}

        {meta.truncated && (
          <p className="text-xs text-neutral-500">
            Showing first {meta.limit ?? meta.row_count} rows — refine your query to narrow the results.
          </p>
        )}

        {meta.sql_debug && (
          <details className="text-xs text-neutral-400">
            <summary className="cursor-pointer select-none hover:text-neutral-600 dark:hover:text-neutral-300">
              SQL debug
            </summary>
            <pre className="mt-1 overflow-x-auto rounded bg-neutral-100 dark:bg-neutral-800 p-2 text-neutral-600 dark:text-neutral-300">
              {meta.sql_debug}
            </pre>
          </details>
        )}

        <div className="border-t border-neutral-100 dark:border-neutral-800 pt-2 mt-1">
          <button
            type="button"
            onClick={() => setShowSource(v => !v)}
            className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            {showSource ? 'Hide source ▲' : 'View source ▼'}
          </button>
          {showSource && (
            <pre className="mt-2 overflow-x-auto rounded bg-neutral-100 dark:bg-neutral-800 p-3 text-xs text-neutral-600 dark:text-neutral-300">
              {JSON.stringify(envelope, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

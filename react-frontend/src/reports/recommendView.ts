import type { ReportColumn, ReportRow } from '../api/reportEnvelope'
import type { ViewType } from './types'

function isMeasure(col: ReportColumn): boolean {
  return col.type === 'decimal' || col.type === 'integer'
}

/**
 * Deterministic view recommendation based on column schema and row count.
 * Rules, in precedence order:
 *
 * 1. KPI   — exactly 1 row, 1 measure, 0 dimensions
 * 2. Line  — at least 1 date dimension + ≥1 measures  (time series)
 * 3. Bar   — exactly 1 categorical dimension + ≥1 measures
 * 4. List  — exactly 1 dimension, 0 measures
 * 5. Table — everything else (multi-dimension, wide, ambiguous, no columns)
 *
 * Note: `pie` is never auto-recommended; it is offered as a manual alternative
 * in the view switcher when the shape is ≤8 rows × 1 categorical dim × 1 measure.
 */
export function recommendView(columns: ReportColumn[], data: ReportRow[]): ViewType {
  const measures = columns.filter(isMeasure)
  const dims = columns.filter(c => !isMeasure(c))
  const dateDims = dims.filter(c => c.type === 'date')
  const categoricalDims = dims.filter(c => c.type === 'string' || c.type === 'enum')

  if (data.length === 1 && measures.length === 1 && dims.length === 0) return 'kpi'
  if (dateDims.length >= 1 && measures.length >= 1) return 'line'
  if (categoricalDims.length === 1 && dims.length === 1 && measures.length >= 1) return 'bar'
  if (dims.length === 1 && measures.length === 0) return 'list'
  return 'table'
}

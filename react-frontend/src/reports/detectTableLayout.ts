import type { ReportColumn } from '../api/reportEnvelope'

export type TableLayout = 'detail' | 'summary' | 'grouped'

function isMeasureCol(col: ReportColumn): boolean {
  return col.type === 'decimal' || col.type === 'integer'
}

/**
 * Derives the appropriate table layout from the IR spec and column schema.
 * Prefers spec.dimensions / spec.measures when available; falls back to
 * column type inference when the spec lacks those arrays.
 *
 * Rules:
 *   measures === 0            → detail  (row-level data, no aggregation)
 *   dims <= 1 && measures ≥ 1 → summary (single grouping + measures)
 *   dims >= 2 && measures ≥ 1 → grouped (hierarchical — Phase 4.3)
 */
export function detectTableLayout(
  spec: Record<string, unknown>,
  columns: ReportColumn[],
): TableLayout {
  const specDims = Array.isArray(spec['dimensions']) ? spec['dimensions'].length : null
  const specMeasures = Array.isArray(spec['measures']) ? spec['measures'].length : null

  const dims = specDims ?? columns.filter(c => !isMeasureCol(c)).length
  const measures = specMeasures ?? columns.filter(c => isMeasureCol(c)).length

  if (measures === 0) return 'detail'
  if (dims <= 1) return 'summary'
  return 'grouped'
}

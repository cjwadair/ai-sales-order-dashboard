import type { ReportColumn } from '../api/reportEnvelope'

export type TableLayout = 'detail' | 'summary' | 'grouped'

/**
 * Derives the appropriate table layout from the IR spec.
 *
 * Rules:
 *   measures === 0            → detail  (row-level data, no aggregation)
 *   dims <= 1 && measures ≥ 1 → summary (single grouping + measures)
 *   dims >= 2 && measures ≥ 1 → grouped (hierarchical — Phase 4.3)
 *
 * Column types are NOT used as a fallback: a decimal column like `order_total`
 * declared as a dimension is indistinguishable from one declared as a measure
 * by type alone. Without explicit spec arrays, default to 'detail'.
 */
export function detectTableLayout(
  spec: Record<string, unknown>,
  _columns: ReportColumn[],
): TableLayout {
  const specDims = Array.isArray(spec['dimensions']) ? spec['dimensions'].length : null
  const specMeasures = Array.isArray(spec['measures']) ? spec['measures'].length : null

  console.log('Spec dimensions:', specDims, 'Spec measures:', specMeasures)

  if (specDims === null || specMeasures === null) return 'detail'

  if (specMeasures === 0) return 'detail'
  if (specDims <= 1) return 'summary'
  return 'grouped'
}

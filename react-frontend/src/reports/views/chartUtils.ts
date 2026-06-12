import type { ReportColumn, ReportRow } from '../../api/reportEnvelope'
import { formatValue } from '../format'

export const PALETTE = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6']

export function isMeasure(col: ReportColumn): boolean {
  return col.type === 'decimal' || col.type === 'integer'
}

export type ChartEntry = Record<string, string | number | null>

// Transforms report rows into Recharts-compatible data: dimension as formatted string under '_x',
// measures as numbers (Recharts needs numeric values for bar/line heights).
export function toChartData(
  rows: ReportRow[],
  dimCol: ReportColumn,
  measures: ReportColumn[],
): ChartEntry[] {
  return rows.map(row => {
    const entry: ChartEntry = { _x: formatValue(row[dimCol.name], dimCol.type) }
    for (const m of measures) {
      const v = row[m.name]
      entry[m.name] = v === null ? null : Number(v)
    }
    return entry
  })
}

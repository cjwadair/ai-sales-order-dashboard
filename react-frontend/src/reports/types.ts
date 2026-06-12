import type { ReportColumn, ReportRow } from '../api/reportEnvelope'

export type ViewType = 'table' | 'bar' | 'line' | 'pie' | 'kpi' | 'list'

export type ViewProps = {
  data: ReportRow[]
  columns: ReportColumn[]
  title: string | null
}

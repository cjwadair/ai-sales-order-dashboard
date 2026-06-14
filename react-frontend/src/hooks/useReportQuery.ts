import { useCallback, useState } from 'react'
import {
  reportEnvelopeSchema,
  reportErrorSchema,
  type ReportEnvelope,
  type ReportColumn,
  type ReportRow,
  type ReportMeta,
} from '../api/reportEnvelope'

export type { ReportEnvelope, ReportColumn, ReportRow, ReportMeta }
export type ReportSpec = Record<string, unknown>

// Thrown for all API-level failures so callers can read structured taxonomy info.
export class ReportQueryError extends Error {
  readonly code: string | null
  readonly details: string[]

  constructor(message: string, code: string | null = null, details: string[] = []) {
    super(message)
    this.name = 'ReportQueryError'
    this.code = code
    this.details = details
  }
}

// Client-threaded history: prior successful turns, sent back so the model
// refines the most recent spec (full-spec-per-turn). Capped to the last 5.
type HistoryTurn = { query: string; spec: ReportSpec }

type UseReportQueryResult = {
  runQuery: (query: string) => Promise<ReportEnvelope>
  clearHistory: () => void
  isLoading: boolean
  hasHistory: boolean
  error: string | null
}

export function useReportQuery(): UseReportQueryResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryTurn[]>([])

  const clearHistory = useCallback(() => setHistory([]), [])

  async function runQuery(query: string): Promise<ReportEnvelope> {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/v1/reports/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history }),
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        const parsed = reportErrorSchema.safeParse(body)
        const code = parsed.success ? parsed.data.error.code : null
        const details = parsed.success ? (parsed.data.error.details ?? []) : []
        const message = parsed.success
          ? (parsed.data.error.message ?? `Request failed: ${res.status}`)
          : `Request failed: ${res.status}`
        throw new ReportQueryError(message, code, details)
      }

      const parsed = reportEnvelopeSchema.safeParse(body)
      if (!parsed.success) {
        throw new Error('Unexpected response from the report service')
      }

      const envelope = parsed.data
      setHistory(prev => [...prev, { query, spec: envelope.spec }].slice(-5))
      return envelope
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Report query failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return { runQuery, clearHistory, isLoading, hasHistory: history.length > 0, error }
}

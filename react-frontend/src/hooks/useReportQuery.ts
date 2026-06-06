import { useCallback, useState } from 'react'

// Mirrors the backend response envelope from POST /api/v1/reports/query.
export type ReportColumn = { name: string; type: string }
export type ReportRow = Record<string, string | number | null>
export type ReportSpec = Record<string, unknown>

export type ReportMeta = {
  row_count: number
  truncated: boolean
  unsupported_note: string | null
  sql_debug?: string
}

export type ReportEnvelope = {
  spec: ReportSpec
  title: string | null
  data: ReportRow[]
  columns: ReportColumn[]
  meta: ReportMeta
}

type ReportError = { error?: { code?: string; message?: string; details?: string[] } }

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

      const body = (await res.json().catch(() => ({}))) as ReportEnvelope | ReportError

      if (!res.ok) {
        const message = (body as ReportError).error?.message ?? `Request failed: ${res.status}`
        throw new Error(message)
      }

      const envelope = body as ReportEnvelope
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

import { useCallback, useState } from 'react'
import { reportEnvelopeSchema, reportErrorSchema, type ReportEnvelope } from '../api/reportEnvelope'
import { ReportQueryError } from './useReportQuery'

export type { ReportEnvelope }
export { ReportQueryError }

type HistoryTurn = { query: string; spec: Record<string, unknown> }

type UseOrdersIrQueryResult = {
  runQuery: (query: string) => Promise<ReportEnvelope>
  clearHistory: () => void
  isLoading: boolean
}

export function useOrdersIrQuery(): UseOrdersIrQueryResult {
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<HistoryTurn[]>([])

  const clearHistory = useCallback(() => setHistory([]), [])

  async function runQuery(query: string): Promise<ReportEnvelope> {
    setIsLoading(true)
    try {
      const res = await fetch('/api/v1/reports/orders_query', {
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
      setHistory(prev => [...prev, { query, spec: envelope.spec as Record<string, unknown> }].slice(-5))
      return envelope
    } finally {
      setIsLoading(false)
    }
  }

  return { runQuery, clearHistory, isLoading }
}

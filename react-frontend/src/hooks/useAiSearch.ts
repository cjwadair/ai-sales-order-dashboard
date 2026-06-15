import { useCallback, useState } from 'react'
import type { OrderStatus } from './useOrders'

export type ParsedFilters = {
  query_description?: string
  search?: string
  status?: OrderStatus
  order_date_from?: string
  order_date_to?: string
  delivery_date_from?: string
  delivery_date_to?: string
  sales_rep?: string
  customer?: string
  order_total_min?: number
  order_total_max?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  warehouse?: string
  order_type?: string
}

type HistoryTurn = { query: string; filters: ParsedFilters }

type UseAiSearchResult = {
  parseQuery: (query: string) => Promise<ParsedFilters>
  clearHistory: () => void
  injectStateCorrection: (filters: ParsedFilters) => void
  isLoading: boolean
  hasHistory: boolean
  error: string | null
  queryDescription: string | null
}

export function useAiSearch(): UseAiSearchResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationHistory, setConversationHistory] = useState<HistoryTurn[]>([])
  const [queryDescription, setQueryDescription] = useState<string | null>(null)

  const clearHistory = useCallback(() => {
    setConversationHistory([])
    setQueryDescription(null)
  }, [])

  const injectStateCorrection = useCallback((filters: ParsedFilters) => {
    setConversationHistory(prev =>
      [...prev, { query: '[Filters manually updated]', filters }].slice(-5)
    )
  }, [])

  async function parseQuery(query: string): Promise<ParsedFilters> {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/v1/parse_query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history: conversationHistory }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Request failed: ${res.status}`)
      }

      const parsed = (await res.json()) as ParsedFilters
      setConversationHistory(prev => [...prev, { query, filters: parsed }].slice(-5))
      setQueryDescription(parsed.query_description ?? null)
      return parsed
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI search failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return { parseQuery, clearHistory, injectStateCorrection, isLoading, hasHistory: conversationHistory.length > 0, error, queryDescription }
}

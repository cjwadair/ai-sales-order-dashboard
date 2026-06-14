import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { faArrowUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useReportQuery, ReportQueryError, type ReportEnvelope } from '../hooks/useReportQuery'
import { ReportResultCard } from '../reports/ReportResultCard'
import { ErrorResultCard } from '../reports/ErrorResultCard'

const RECENT_QUERIES = [
  { when: '2 hours ago', title: 'Previous Month Sales', query: 'Total sales by sales rep last month' },
  { when: '1 day ago', title: 'YTD Sales by Rep', query: 'YTD sales by rep, top 5' },
]

type SuccessResult = { kind: 'success'; envelope: ReportEnvelope }
type ErrorResult = { kind: 'error'; message: string; code: string | null; details: string[] }
type ResultItem = SuccessResult | ErrorResult

export function ChatPage() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const { runQuery, clearHistory, isLoading } = useReportQuery()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [results, isLoading])

  async function submit(query: string) {
    const trimmed = query.trim()
    if (!trimmed || isLoading) return
    setInput('')
    try {
      const envelope = await runQuery(trimmed)
      setResults(prev => [...prev, { kind: 'success', envelope }])
    } catch (err) {
      setResults(prev => [
        ...prev,
        {
          kind: 'error',
          message: err instanceof Error ? err.message : 'Report query failed',
          code: err instanceof ReportQueryError ? err.code : null,
          details: err instanceof ReportQueryError ? err.details : [],
        },
      ])
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit(input)
    }
  }

  function clearAll() {
    clearHistory()
    setResults([])
  }

  return (
    <section className="flex flex-col h-dvh max-h-screen w-full">
      <PageHeader title="Chat" />

      {/* Scrollable history — content anchors to the bottom when short */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col min-h-full justify-end max-w-3xl mx-auto px-6 py-6 gap-4">
          {results.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center gap-10 py-16">
              <h2 className="text-4xl font-medium tracking-tight">Good morning, Chris</h2>
              <div className="w-full flex flex-col gap-3">
                <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wide">
                  Recent queries
                </h3>
                <div className="flex gap-4 flex-wrap">
                  {RECENT_QUERIES.map(rq => (
                    <button
                      key={rq.title}
                      type="button"
                      onClick={() => void submit(rq.query)}
                      className="flex flex-col gap-1 text-left cursor-pointer max-w-xs"
                    >
                      <div className="text-xs text-neutral-400">{rq.when}</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-md shadow-sm hover:bg-neutral-200 dark:hover:bg-neutral-700">
                        <div className="font-medium mb-1">{rq.title}</div>
                        <div className="text-neutral-500 dark:text-neutral-400">{rq.query}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            results.map((item, i) =>
              item.kind === 'success' ? (
                <ReportResultCard key={i} envelope={item.envelope} />
              ) : (
                <ErrorResultCard key={i} message={item.message} code={item.code} details={item.details} />
              ),
            )
          )}

          {isLoading && (
            <div className="text-neutral-500 text-sm py-2">Running query…</div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Fixed compose bar */}
      <div className="flex-shrink-0 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-6 py-4">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {results.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                Clear conversation
              </button>
            </div>
          )}
          <div className="flex items-end gap-3">
            <textarea
              className="flex-1 min-h-[44px] max-h-32 resize-none rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-neutral-100 placeholder:text-neutral-400"
              placeholder="Ask me anything…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
            />
            <button
              type="button"
              onClick={() => void submit(input)}
              disabled={isLoading || !input.trim()}
              aria-label="Send query"
              className="h-11 w-11 flex-shrink-0 border border-neutral-300 dark:border-neutral-600 rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon icon={faArrowUp} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp, faWandMagicSparkles, faXmark } from '@fortawesome/free-solid-svg-icons'
import clsx from 'clsx'
import { useOrdersIrQuery, ReportQueryError, type ReportEnvelope } from '../hooks/useOrdersIrQuery'
import { detectTableLayout, type TableLayout } from '../reports/detectTableLayout'
import { DetailTableView } from '../reports/views/DetailTableView'
import { SummaryTableView } from '../reports/views/SummaryTableView'
import { PageHeader } from '../components/PageHeader'

type SuccessExchange = {
  kind: 'success'
  query: string
  envelope: ReportEnvelope
  layoutOverride?: TableLayout
}
type ErrorExchange = {
  kind: 'error'
  query: string
  message: string
  code: string | null
  details: string[]
}
type Exchange = SuccessExchange | ErrorExchange

const LAYOUT_LABELS: Record<TableLayout, string> = {
  detail: 'Detail',
  summary: 'Summary',
  grouped: 'Grouped',
}

// Grouped is not yet implemented (Phase 4.3); treat it as summary for display.
function resolvedDisplayLayout(layout: TableLayout): 'detail' | 'summary' {
  return layout === 'grouped' ? 'summary' : layout
}

function errorHint(code: string | null): string | null {
  if (code === 'timeout') return 'Try narrowing the date range or adding a row limit.'
  if (code === 'upstream_error' || code === 'internal') return 'Something went wrong on the server. Please try again.'
  return null
}

export function OrdersIrPage() {
  const [input, setInput] = useState('')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { runQuery, clearHistory, isLoading } = useOrdersIrQuery()
  const sidebarBottomRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    sidebarBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [exchanges])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void submit('show me all orders')
  }, [])

  async function submit(query: string) {
    const trimmed = query.trim()
    if (!trimmed || isLoading) return
    setInput('')
    const newIndex = exchanges.length
    try {
      const envelope = await runQuery(trimmed)
      setExchanges(prev => [...prev, { kind: 'success', query: trimmed, envelope }])
      setSelectedIndex(newIndex)
    } catch (err) {
      setExchanges(prev => [
        ...prev,
        {
          kind: 'error',
          query: trimmed,
          message: err instanceof Error ? err.message : 'Report query failed',
          code: err instanceof ReportQueryError ? err.code : null,
          details: err instanceof ReportQueryError ? err.details : [],
        },
      ])
      setSelectedIndex(newIndex)
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
    setExchanges([])
    setSelectedIndex(null)
  }

  function setLayoutOverride(layout: TableLayout) {
    if (selectedIndex === null) return
    setExchanges(prev =>
      prev.map((ex, i) =>
        i === selectedIndex && ex.kind === 'success' ? { ...ex, layoutOverride: layout } : ex,
      ),
    )
  }

  const selected = selectedIndex !== null ? (exchanges[selectedIndex] ?? null) : null

  const detectedLayout =
    selected?.kind === 'success'
      ? detectTableLayout(selected.envelope.spec, selected.envelope.columns)
      : null

  const activeLayout =
    selected?.kind === 'success'
      ? (selected.layoutOverride ?? detectedLayout ?? 'detail')
      : null

  const displayLayout = activeLayout ? resolvedDisplayLayout(activeLayout) : null

  console.log('Selected exchange:', selected, 'Detected layout:', detectedLayout, 'Active layout:', activeLayout, 'Display layout:', displayLayout)

  return (
  <section className="flex flex-col gap-5 h-dvh max-h-screen sm:mx-6 lg:mx-10 xl:px-0 xl:max-w-11/12 3xl:max-w-10/12 xl:mx-auto">
    <PageHeader title="Smart Orders"/>

    <div className="flex items-center justify-between gap-4">
      <div className="w-1/3 flex items-center gap-2">
        <textarea
          className="flex-1 min-h-[36px] max-h-20 resize-none rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-neutral-100 placeholder:text-neutral-400"
          placeholder="Ask about your sales data…"
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
          className="h-9 w-9 flex-shrink-0 border border-neutral-300 dark:border-neutral-600 rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FontAwesomeIcon icon={faArrowUp} className="text-sm" />
        </button>
      </div>

      <div className="flex-shrink-0 flex items-center gap-3">
        <div className="flex items-center gap-x-1 rounded-lg border border-neutral-200 dark:border-neutral-700">
          {selected?.kind === 'success' && (['detail', 'summary'] as const).map(layout => (
            <button
              key={layout}
              type="button"
              onClick={() => setLayoutOverride(layout)}
              className={clsx(
                'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                activeLayout === layout
                  ? 'bg-brand-500 text-white'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
              )}
            >
              {LAYOUT_LABELS[layout]}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsSidebarOpen(prev => !prev)}
          aria-expanded={isSidebarOpen}
          aria-label="Toggle AI query sidebar"
          className="inline-flex items-center px-2 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700 cursor-pointer rounded-md"
        >
          <FontAwesomeIcon icon={faWandMagicSparkles} className="text-accent-800" />
          <span className="ml-1">AI Query</span>
        </button>
      </div>
    </div>

    <div className="flex-1 min-h-0 mb-4 flex flex-col gap-2 overflow-hidden">
      {selected?.kind === 'success' && (
        <div className="flex-shrink-0 flex items-baseline gap-3 text-sm">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            {selected.envelope.title ?? 'Query Result'}
          </h3>
          {selected.envelope.meta.truncated && (
            <p className="text-neutral-500">
              Showing first {selected.envelope.meta.limit ?? selected.envelope.meta.row_count} rows — refine your query to narrow the results.
            </p>
          )}
          {selected.envelope.meta.unsupported_note && (
            <p className="text-amber-700 dark:text-amber-400">
              Note: {selected.envelope.meta.unsupported_note}
            </p>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {selected === null ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-neutral-400 dark:text-neutral-500">
              {isLoading ? 'Loading…' : 'No results yet.'}
            </p>
          </div>
        ) : selected.kind === 'error' ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div
              role="alert"
              className="max-w-2xl rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 px-4 py-3 text-sm"
            >
              <p className="font-semibold text-red-700 dark:text-red-300 mb-1">{selected.query}</p>
              <p className="text-red-600 dark:text-red-400">{selected.message}</p>
              {errorHint(selected.code) && (
                <p className="mt-1 text-red-500 dark:text-red-400">{errorHint(selected.code)}</p>
              )}
              {selected.details.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-red-600 dark:text-red-400">
                  {selected.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Table */}
            <div className="flex-1 overflow-hidden">
              {displayLayout === 'summary' ? (
                <SummaryTableView
                  data={selected.envelope.data}
                  columns={selected.envelope.columns}
                  title={selected.envelope.title}
                />
              ) : (
                <DetailTableView
                  data={selected.envelope.data}
                  columns={selected.envelope.columns}
                  title={selected.envelope.title}
                />
              )}
              {selected.envelope.meta.sql_debug && (
                <details className="mt-4 text-xs text-neutral-400">
                  <summary className="cursor-pointer select-none hover:text-neutral-600 dark:hover:text-neutral-300">
                    SQL debug
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-neutral-100 dark:bg-neutral-800 p-2 text-neutral-600 dark:text-neutral-300">
                    {selected.envelope.meta.sql_debug}
                  </pre>
                </details>
              )}
            </div>
          </main>
        )}
      </div>

      {/* AI query sidebar — hidden by default, slides in from the right */}
      <aside
        className={clsx(
          'flex-shrink-0 overflow-hidden transition-[width,height] duration-300 fixed right-17 shadow-lg shadow-neutral-300 dark:shadow-neutral-800',
          isSidebarOpen ? 'w-80 h-3/4 overflow-y-hidden ml-3' : 'w-0 h-0',
        )}
      >
        <div className="w-80 h-full flex flex-col border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800">
          <div className="flex-shrink-0 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-700 dark:text-neutral-300">Sales Queries</h2>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close AI query sidebar"
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          {/* Exchange list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
            {exchanges.length === 0 && !isLoading && (
              <p className="text-xs text-neutral-400 text-center mt-4 px-2">
                Ask a question about your sales data to get started.
              </p>
            )}
            {exchanges.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={clsx(
                  'w-full text-left rounded-lg px-3 py-2.5 flex flex-col gap-1 transition-colors border',
                  i === selectedIndex
                    ? 'bg-brand-50 dark:bg-brand-950 border-brand-200 dark:border-brand-800'
                    : 'border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800',
                )}
              >
                <span className="text-sm line-clamp-2 leading-relaxed">
                  {ex.query}
                </span>
                <span
                  className={clsx(
                    'text-sm font-medium line-clamp-1',
                    ex.kind === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-neutral-800 dark:text-neutral-200',
                  )}
                >
                  {ex.kind === 'success' ? (ex.envelope.title ?? 'Result') : ex.message}
                </span>
              </button>
            ))}
            {isLoading && (
              <div className="px-3 py-2 text-xs text-neutral-400">Running query…</div>
            )}
            <div ref={sidebarBottomRef} />
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 border-t border-neutral-200 dark:border-neutral-700 px-3 py-3 flex flex-col gap-2">
            {exchanges.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  Clear history
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 min-h-[40px] max-h-28 resize-none rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-neutral-100 placeholder:text-neutral-400"
                placeholder="Ask about your sales…"
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
                className="h-10 w-10 flex-shrink-0 border border-neutral-300 dark:border-neutral-600 rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon icon={faArrowUp} className="text-sm" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </section>
  )
}

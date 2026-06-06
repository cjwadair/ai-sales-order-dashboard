import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { faArrowUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useReportQuery, type ReportEnvelope } from '../hooks/useReportQuery'

const RECENT_QUERIES = [
  { when: '2 hours ago', title: 'Previous Month Sales', query: 'Total sales by sales rep last month' },
  { when: '1 day ago', title: 'YTD Sales by Rep', query: 'YTD sales by rep, top 5' },
]

export function ChatPage() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<ReportEnvelope | null>(null)
  const { runQuery, isLoading, error } = useReportQuery()

  async function submit(query: string) {
    const trimmed = query.trim()
    if (!trimmed || isLoading) return
    try {
      setResult(await runQuery(trimmed))
    } catch {
      setResult(null) // error surfaced via the hook's `error`
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit(input)
    }
  }

  return (
    <section className="flex flex-col gap-5 h-dvh max-h-screen w-full">
      <PageHeader title="Chat Page" />
      <div className="page-row flex flex-col items-center h-full gap-12 overflow-y-auto py-8">
        <h2 className="text-4xl font-medium tracking-tight">Good Morning, Chris</h2>

        <div className="w-3/4 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-sm p-6 flex items-start gap-6">
          <textarea
            className="flex-1 h-12 resize-none"
            placeholder="Ask me anything..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => submit(input)}
            disabled={isLoading || !input.trim()}
            aria-label="Send query"
            className="h-12 w-12 border rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FontAwesomeIcon icon={faArrowUp} />
          </button>
        </div>

        {isLoading && <div className="text-neutral-500">Running query…</div>}

        {error && (
          <div className="w-3/4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {result && !isLoading && (
          <div className="w-3/4 flex flex-col gap-2">
            <h3 className="text-xl text-left self-start">{result.title ?? 'Result'}</h3>
            {result.meta.unsupported_note && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Note: {result.meta.unsupported_note}
              </div>
            )}
            <pre className="w-full overflow-x-auto rounded-md bg-neutral-100 dark:bg-neutral-800 p-4 text-sm text-left">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        {!result && !isLoading && (
          <div className="w-3/4 flex flex-col items-start gap-4">
            <h3 className="text-xl text-left self-start">Recent Queries</h3>
            <div className="w-full flex gap-6">
              {RECENT_QUERIES.map(rq => (
                <button
                  key={rq.title}
                  type="button"
                  onClick={() => {
                    setInput(rq.query)
                    submit(rq.query)
                  }}
                  className="flex flex-col gap-1 text-left cursor-pointer"
                >
                  <div className="text-sm text-neutral-500">{rq.when}</div>
                  <div className="text-base text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-md shadow-sm hover:bg-neutral-200 dark:hover:bg-neutral-700">
                    <div className="font-medium mb-1">{rq.title}</div>
                    <div className="text-sm">{rq.query}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

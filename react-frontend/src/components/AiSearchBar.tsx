import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'

type AiSearchBarProps = {
  onSearch: (query: string) => Promise<void>
  isLoading: boolean
  error: string | null
}

export function AiSearchBar({ onSearch, isLoading, error }: AiSearchBarProps) {
  const [query, setQuery] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || isLoading) return
    await onSearch(trimmed)
    setQuery('')
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full">
        <div className="relative flex-1 text-base text-neutral-600">
          <FontAwesomeIcon
            icon={faWandMagicSparkles}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-800"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Ask AI — try "show completed orders for the last 30 days"'
            aria-label="AI search"
            disabled={isLoading}
            className="block w-full rounded-md border border-neutral-400 bg-white placeholder:text-neutral-500 py-2 pl-9 pr-3 sm:text-sm focus:border-accent-800 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-400 disabled:opacity-60"
          />
        </div>
      </form>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}

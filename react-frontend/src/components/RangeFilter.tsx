type RangeFilterProps = {
  label: string
  value: { from?: number; to?: number }
  onChange: (update: Partial<{ from: number | undefined; to: number | undefined }>) => void
  onClear?: () => void
}

function parseInput(raw: string): number | undefined {
  return raw === '' ? undefined : Number(raw)
}

export function RangeFilter({ label, value, onChange, onClear }: RangeFilterProps) {
  return (
    <div className="flex items-center gap-2 border border-neutral-300 dark:border-neutral-600 rounded-sm px-2 py-1">
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        <span>{label}: </span>
        <input
          type="number"
          placeholder="Any"
          className="mr-1 my-1 border border-neutral-300 dark:border-neutral-600 rounded-sm px-1 py-0.5 focus:outline-none"
          value={value.from ?? ''}
          onChange={(e) => onChange({ from: parseInput(e.target.value) })}
        />
        <span className="mx-1">to</span>
        <input
          type="number"
          placeholder="Any"
          className="mr-1 my-1 border border-neutral-300 dark:border-neutral-600 rounded-sm px-1 py-0.5 focus:outline-none"
          value={value.to ?? ''}
          onChange={(e) => onChange({ to: parseInput(e.target.value) })}
        />
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
      >
        Clear
      </button>
    </div>
  )
}
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
      <div className="text-sm flex items-center gap-1">
        <span>{label}: </span>
        <div className="relative">
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">$</span>
          <input
            type="text"
            placeholder="Any"
            size={4}
            className="pl-4 mr-1 my-1 border border-neutral-300 dark:border-neutral-600 rounded-sm pr-1 py-0.5 focus:outline-none"
            value={value.from ?? ''}
            onChange={(e) => onChange({ from: parseInput(e.target.value) })}
          />
        </div>
        <span>to</span>
        <div className="relative">
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">$</span>
          <input
            type="text"
            placeholder="Any"
            size={4}
            className="pl-4 mr-1 my-1 border border-neutral-300 dark:border-neutral-600 rounded-sm pr-1 py-0.5 focus:outline-none"
            value={value.to ?? ''}
            onChange={(e) => onChange({ to: parseInput(e.target.value) })}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-sm"
      >
        Clear
      </button>
    </div>
  )
}
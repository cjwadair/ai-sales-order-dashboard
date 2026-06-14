type ErrorResultCardProps = {
  message: string
  code: string | null
  details: string[]
}

export function ErrorResultCard({ message, code, details }: ErrorResultCardProps) {
  const hint =
    code === 'timeout'
      ? 'Try narrowing the date range or adding a row limit.'
      : code === 'upstream_error' || code === 'internal'
        ? 'Something went wrong on the server. Please try again.'
        : null

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 px-4 py-3 text-sm"
    >
      <p className="font-medium text-red-700 dark:text-red-300">{message}</p>
      {hint && <p className="mt-1 text-red-600 dark:text-red-400">{hint}</p>}
      {details.length > 0 && (
        <ul className="mt-2 list-disc list-inside text-red-600 dark:text-red-400">
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

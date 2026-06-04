import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

type SearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  icon?: IconDefinition
  className?: string
  inputClassName?: string
  iconClassName?: string
}

const defaultClassName = 'relative text-base text-neutral-600'

const defaultInputClassName =
  'block w-full rounded-md border border-neutral-400 bg-white py-2 pl-9 pr-9 focus:border-accent-800 sm:text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-400'

const defaultIconClassName = 'absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500'

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  ariaLabel,
  icon = faMagnifyingGlass,
  className,
  inputClassName,
  iconClassName,
}: SearchInputProps) {
  return (
    <div className={className ?? defaultClassName}>
      <FontAwesomeIcon icon={icon} className={iconClassName ?? defaultIconClassName} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={inputClassName ?? defaultInputClassName}
      />
      {value && <FontAwesomeIcon icon={faXmark} className={`${iconClassName ?? defaultIconClassName} right-3 left-auto cursor-pointer`} onClick={() => onChange('')} />}
    </div>
  )
}
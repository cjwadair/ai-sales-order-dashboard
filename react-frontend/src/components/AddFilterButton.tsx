import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faPlus } from '@fortawesome/free-solid-svg-icons'
import { useClickOutside } from '../hooks/useClickOutside'

type AddFilterOption<T extends string> = {
  id: T
  label: string
}

type AddFilterButtonProps<T extends string> = {
  filters: readonly AddFilterOption<T>[]
  activeFilterIds: ReadonlySet<T>
  onActivateFilter: (filterId: T) => void
  className?: string
  triggerClassName?: string
  menuClassName?: string
  optionClassName?: string
  triggerLabel?: string
}

const defaultTriggerClassName =
  'inline-flex items-center px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 border border-neutral-300 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700 cursor-pointer rounded-md list-none'

const defaultMenuClassName =
  'absolute left-0 z-10 mt-2 rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800'

const defaultOptionClassName =
  'block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700 first:rounded-t-sm last:rounded-b-sm'

export function AddFilterButton<T extends string>({
  filters,
  activeFilterIds,
  onActivateFilter,
  className,
  triggerClassName,
  menuClassName,
  optionClassName,
  triggerLabel = 'Filter',
}: AddFilterButtonProps<T>) {
  const detailsRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  const availableFilters = filters.filter((filter) => !activeFilterIds.has(filter.id))

  useClickOutside(detailsRef, () => setIsOpen(false), isOpen)

  function close() {
    setIsOpen(false)
  }

  return (
    <div className={className ?? 'relative'} ref={detailsRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={triggerClassName ?? defaultTriggerClassName}
        onClick={() => { setIsOpen((prev) => !prev)}}
      >
        <FontAwesomeIcon icon={faPlus} className="font-medium text-neutral-700" />
        <span className="ml-1">{triggerLabel}</span>
        <FontAwesomeIcon icon={faChevronDown} className="ml-1 text-xs" />
      </button>
      {isOpen && (
        <div role="listbox" className={menuClassName ?? defaultMenuClassName}>
          {availableFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="option"
              aria-selected={activeFilterIds.has(filter.id)}
              onClick={() => {
                onActivateFilter(filter.id)
                close()
              }}
              className={optionClassName ?? defaultOptionClassName}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

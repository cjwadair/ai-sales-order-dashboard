import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAngleDown } from '@fortawesome/free-solid-svg-icons'
import { capitalizeWords, pluralizeWord } from '../utils/formatters'
import { useClickOutside } from '../hooks/useClickOutside'

type PlaceholderValue = 'Any' | 'All'

type DropdownFilterProps<T> = {
  options: readonly T[]
  selectedValue: T | undefined
  onSelect: (value: T | undefined) => void
  label: string
  placeholderValue?: PlaceholderValue
  clearLabel?: string
  getOptionLabel?: (option: T) => string
  getOptionKey?: (option: T) => string
  className?: string
  triggerClassName?: string
  menuClassName?: string
  optionClassName?: string
}

const defaultTriggerClassName =
  'inline-flex list-none cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 [&::-webkit-details-marker]:hidden dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'

const defaultMenuClassName =
  'absolute left-0 z-10 mt-2 rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800'

const defaultOptionClassName =
  'block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700'

function formatLabel(label: string) {
  const words = label.trim().split(/\s+/)
  
  if (words.length === 0) {
    return label
  }

  const lastWord = words[words.length - 1]
  words[words.length - 1] = pluralizeWord(lastWord)
  return capitalizeWords(words.join(' '))
}

export function DropdownFilter<T>({
  options,
  selectedValue,
  onSelect,
  label,
  placeholderValue,
  clearLabel,
  getOptionLabel = (option) => String(option),
  getOptionKey = (option) => String(option),
  className,
  triggerClassName,
  menuClassName,
  optionClassName,
}: DropdownFilterProps<T>) {
  const detailsRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  useClickOutside(detailsRef, () => setIsOpen(false), isOpen)

  function close() {
    setIsOpen(false)
  }

  const resolvedPlaceholderValue = placeholderValue ?? 'All'
  const resolvedLabelValue = resolvedPlaceholderValue === 'Any' ? label : formatLabel(label)
  const resolvedClearLabel = clearLabel ?? `${resolvedPlaceholderValue} ${resolvedLabelValue}`
  const triggerLabel = `${label}: ${selectedValue !== undefined ? capitalizeWords(getOptionLabel(selectedValue)) : resolvedPlaceholderValue}`

  return (
    <div className="flex items-center text-neutral-700 rounded-md gap-2">
      <div className={className ?? 'relative'} ref={detailsRef}>
        <button 
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={triggerClassName ?? defaultTriggerClassName}
          onClick={() => { setIsOpen((prev) => !prev) }}
        >
          {triggerLabel}
          <FontAwesomeIcon icon={faAngleDown} className="ml-2 text-neutral-700" />
        </button>
        { isOpen && (
          <div className={menuClassName ?? defaultMenuClassName}>
            <button
              type="button"
              onClick={() => { onSelect(undefined); close() }}
              className={optionClassName ?? defaultOptionClassName}
          >
            {resolvedClearLabel}
            </button>
            {options.map((option) => (
              <button
                key={getOptionKey(option)}
                type="button"
                onClick={() => { onSelect(option); close() }}
                className={optionClassName ?? defaultOptionClassName}
              >
                {capitalizeWords(getOptionLabel(option))}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

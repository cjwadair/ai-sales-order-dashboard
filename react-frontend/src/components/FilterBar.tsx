import { Fragment, useMemo, useState } from 'react'
import { AddFilterButton } from './AddFilterButton'
import { AiSearchBar } from './AiSearchBar'
import { DateRangeFilter } from './DateRangeFilter'
import { DropdownFilter } from './DropdownFilter'
import { SearchInput } from './SearchInput'
import { RangeFilter } from './RangeFilter'

type DropdownPlaceholder = 'Any' | 'All'

type SearchFilterConfig = {
  type: 'search'
  id: string
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder?: string
  ariaLabel?: string
  active?: boolean
  activeByDefault?: boolean
}

type DateRangeFilterConfig = {
  type: 'dateRange'
  id: string
  label: string
  value: { from: Date | undefined; to: Date | undefined }
  onChange: (update: Partial<{ from: Date | undefined; to: Date | undefined }>) => void
  onClear: () => void
  active?: boolean
  activeByDefault?: boolean
}

type RangeFilterConfig = {
  type: 'range'
  id: string
  label: string
  value: { from: number | undefined; to: number | undefined }
  onChange: (update: Partial<{ from: number | undefined; to: number | undefined }>) => void
  onClear: () => void
  active?: boolean
  activeByDefault?: boolean
}

type DropdownFilterConfig = {
  type: 'dropdown'
  id: string
  label: string
  options: readonly string[] | (() => readonly string[])
  selectedValue: string | undefined
  onSelect: (value: string | undefined) => void
  onClear: () => void
  active?: boolean
  activeByDefault?: boolean
  placeholderValue?: DropdownPlaceholder
  clearLabel?: string
}

export type AiSearchFilterConfig = {
  type: 'aiSearch'
  id: string
  onSearch: (query: string) => Promise<void>
  onClear: () => void
  hasHistory: boolean
  isLoading: boolean
  error: string | null
  active?: boolean
  activeByDefault?: boolean
}

export type FilterConfig = SearchFilterConfig | DateRangeFilterConfig | DropdownFilterConfig | AiSearchFilterConfig | RangeFilterConfig

type FilterBarProps = {
  filters?: readonly FilterConfig[]
  activeFilterIds?: Set<string>
  onActiveFilterIdsChange?: (ids: Set<string>) => void
  filtersClassName?: string
  addFilterButtonLabel?: string
  clearFiltersLabel?: string
}

const defaultFiltersClassName = 'flex flex-wrap items-center gap-4'

function mergeClassName(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base
}

const defaultDropdownMenuClassName =
  'absolute left-0 z-10 mt-2 w-44 rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800'

function filterHasValue(filter: FilterConfig): boolean {
  switch (filter.type) {
    case 'search':    return filter.value !== ''
    case 'dateRange': return filter.value.from !== undefined
    case 'dropdown':  return filter.selectedValue !== undefined
    case 'aiSearch':  return filter.hasHistory
    case 'range':     return filter.value.from !== undefined || filter.value.to !== undefined
  }
}

export function FilterBar({
  filters = [],
  activeFilterIds: controlledActiveIds,
  onActiveFilterIdsChange,
  filtersClassName,
  addFilterButtonLabel,
  clearFiltersLabel = 'Clear Filters',
}: FilterBarProps) {
  const [internalActiveIds, setInternalActiveIds] = useState<Set<string>>(
    () => new Set(filters.filter((f) => f.active).map((f) => f.id)),
  )

  const isControlled = controlledActiveIds !== undefined
  const activeFilterIds = isControlled ? controlledActiveIds : internalActiveIds

  function setActiveFilterIds(updater: (prev: Set<string>) => Set<string>) {
    const next = updater(activeFilterIds)
    if (isControlled) {
      onActiveFilterIdsChange?.(next)
    } else {
      setInternalActiveIds(next)
    }
  }

  function activateFilter(filterId: string) {
    setActiveFilterIds((previousIds) => {
      if (previousIds.has(filterId)) {
        return previousIds
      }

      const nextIds = new Set(previousIds)
      nextIds.add(filterId)
      return nextIds
    })
  }

  function deactivateFilter(filterId: string) {
    setActiveFilterIds((previousIds) => {
      if (!previousIds.has(filterId)) {
        return previousIds
      }

      const nextIds = new Set(previousIds)
      nextIds.delete(filterId)
      return nextIds
    })
  }

  const activeFilters = useMemo(
    () => filters.filter((f) => activeFilterIds.has(f.id)),
    [activeFilterIds, filters],
  )

  const inactiveFilters = useMemo(
    () => filters.filter((f) => !activeFilterIds.has(f.id)),
    [activeFilterIds, filters],
  )

  const anyFilterHasValue = useMemo(
    () => activeFilters.some(filterHasValue),
    [activeFilters],
  )

  function clearAllFilters() {
    activeFilters.forEach((f) => f.onClear())
    setActiveFilterIds((prev) => {
      const next = new Set(prev)
      activeFilters.forEach((f) => {
        if (!f.activeByDefault) next.delete(f.id)
      })
      return next
    })
  }

  function renderActiveFilter(filter: FilterConfig) {
    switch (filter.type) {
      case 'search':
        return (
          <SearchInput
            value={filter.value}
            onChange={(v) => {
              filter.onChange(v)
              if (v === '' && !filter.activeByDefault) deactivateFilter(filter.id)
            }}
            placeholder={filter.placeholder}
            ariaLabel={filter.ariaLabel}
          />
        )
      case 'dateRange':
        return (
          <DateRangeFilter
            label={filter.label}
            value={filter.value}
            onChange={filter.onChange}
            onClear={() => {
              filter.onClear()
              if (!filter.activeByDefault) deactivateFilter(filter.id)
            }}
          />
        )
      case 'range':
        return (
          <RangeFilter
            label={filter.label}
            value={filter.value}
            onChange={filter.onChange}
            onClear={() => {
              filter.onClear()
              if (!filter.activeByDefault) deactivateFilter(filter.id)
            }}
          />
        )
      case 'dropdown': {
        const resolvedOptions = typeof filter.options === 'function' ? filter.options() : filter.options
        return (
          <DropdownFilter
            options={resolvedOptions}
            selectedValue={filter.selectedValue}
            onSelect={(value) => {
              if (value === undefined) {
                filter.onClear()
                if (!filter.activeByDefault) deactivateFilter(filter.id)
                return
              }
              filter.onSelect(value)
            }}
            placeholderValue={filter.placeholderValue ?? 'Any'}
            label={filter.label}
            clearLabel={filter.clearLabel}
            menuClassName={defaultDropdownMenuClassName}
          />
        )
      }
      case 'aiSearch':
        return (
          <AiSearchBar
            onSearch={filter.onSearch}
            isLoading={filter.isLoading}
            error={filter.error}
          />
        )
    }
  }

  const activeAiFilter = activeFilters.find((f) => f.type === 'aiSearch') as AiSearchFilterConfig | undefined

  if (activeAiFilter) {
    const activeNonAiFilters = activeFilters.filter((f) => f.type !== 'aiSearch')
    const hasFilterRow = activeNonAiFilters.length > 0 || anyFilterHasValue
    return (
      <div className="page-row flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-10/12 xl:max-w-3/4 2xl:max-w-2/3">{renderActiveFilter(activeAiFilter)}</div>
          {inactiveFilters.length > 0 && (
            <AddFilterButton
              filters={inactiveFilters.map((f) => ({ id: f.id, label: 'label' in f ? f.label : f.id }))}
              activeFilterIds={activeFilterIds}
              onActivateFilter={activateFilter}
              triggerLabel={addFilterButtonLabel}
            />
          )}
        </div>
        {hasFilterRow && (
          <div className={mergeClassName(defaultFiltersClassName, filtersClassName)}>
            {activeNonAiFilters.map((filter) => (
              <Fragment key={filter.id}>{renderActiveFilter(filter)}</Fragment>
            ))}
            <button type="button" onClick={clearAllFilters} className="button-link">
              {clearFiltersLabel}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page-row flex justify-between mt-4">
      <div className={mergeClassName(defaultFiltersClassName, filtersClassName)}>
        {activeFilters.map((filter) => (
          <Fragment key={filter.id}>{renderActiveFilter(filter)}</Fragment>
        ))}
        {anyFilterHasValue && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="button-link text-sm"
          >
            {clearFiltersLabel}
          </button>
        )}
      </div>
      <div>
        {inactiveFilters.length > 0 && (
          <AddFilterButton
            filters={inactiveFilters.map((f) => ({ id: f.id, label: 'label' in f ? f.label : f.id }))}
            activeFilterIds={activeFilterIds}
            onActivateFilter={activateFilter}
            triggerLabel={addFilterButtonLabel}
          />
        )}
      </div>
    </div>
  )
}

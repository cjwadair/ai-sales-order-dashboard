import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { validateColumnSpans } from './gridTableUtils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons'
import { clsx } from 'clsx'

type ColumnAlign = 'left' | 'center' | 'right'

export type SortOrder = 'asc' | 'desc'

export type SortState<TItem> = {
  field: GridColumnFieldKey<TItem>
  order: SortOrder
}

type GridColumnFieldKey<TItem> = TItem extends object ? (keyof TItem & string) : string

type GridColumnBase<TItem> = {
  header?: ReactNode
  customHeader?: ReactNode | ((column: GridColumn<TItem>, columnIndex: number) => ReactNode)
  customCell?: ReactNode | ((item: TItem, column: GridColumn<TItem>, rowIndex: number) => ReactNode)
  span?: number
  align?: ColumnAlign
  headerClassName?: string
  cellClassName?: string
}

type GridColumnWithField<TItem> = GridColumnBase<TItem> & {
  field: GridColumnFieldKey<TItem>
  key?: string
  initialSortOrder?: SortOrder
  valueFormatter?: (value: unknown, item: TItem) => string
}

type GridColumnWithKey<TItem> = GridColumnBase<TItem> & {
  key: string
  field?: GridColumnFieldKey<TItem>
}

export type GridColumn<TItem = unknown> = GridColumnWithField<TItem> | GridColumnWithKey<TItem>

export type GridTableProps<TItem> = {
  items: readonly TItem[]
  columns: readonly GridColumn<TItem>[]
  sort?: SortState<TItem>
  onSortChange?: (sort: SortState<TItem>) => void
  totalColumns: number
  getRowKey: (item: TItem, index: number) => string
  children?: ReactNode
  emptyState?: ReactNode
  containerClassName?: string
  bodyClassName?: string
  defaultHeaderCellClassName?: string
  defaultCellClassName?: string
  validateSpans?: boolean
  headerClassName?: string
  renderHeaderCell?: (column: GridColumn<TItem>, columnIndex: number) => ReactNode
  rowClassName?: string
  renderCell?: (column: GridColumn<TItem>, item: TItem, index: number) => ReactNode
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
}

export type GridTableHeaderProps<TItem = unknown> = {
  className?: string
  renderHeaderCell?: (column: GridColumn<TItem>, columnIndex: number) => ReactNode
}

export type GridTableRowsProps<TItem> = {
  className?: string
  renderCell?: (column: GridColumn<TItem>, item: TItem, index: number) => ReactNode
}

export type GridTableRowProps = {
  className?: string
  children: ReactNode
}

export type GridTableCellProps = {
  columnKey: string
  className?: string
  children: ReactNode
}

const gridColumnsClassNames: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12',
}

const columnSpanClassNames: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
}

const alignmentClassNames: Record<ColumnAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

const defaultContainerClassName = 'h-full overflow-hidden rounded-xl border border-neutral-300 bg-white sm:mx-6 lg:mx-10 xl:px-0 xl:max-w-11/12 3xl:max-w-10/12 xl:mx-auto dark:border-neutral-700 dark:bg-neutral-900'
const defaultBodyClassName = 'h-full flex flex-col w-full text-left text-sm'
const defaultRowLayoutClassName = 'grid gap-2 justify-stretch items-center w-full'
const defaultHeaderClassName = 'h-14 bg-accent-100 border border-accent-200 text-accent-800 dark:bg-neutral-800 dark:text-neutral-300 align-bottom'
const headerCellClassName = 'px-4 font-medium'
const cellClassName = 'px-4 text-neutral-800 dark:text-neutral-300'
const defaultRowHeightClassName = 'h-16 border-t border-neutral-200 dark:border-neutral-700'
const defaultEmptyStateClassName = 'border-t border-neutral-200 dark:border-neutral-700'
const defaultEmptyStateMessageClassName = 'px-4 py-8 text-center text-neutral-500 dark:text-neutral-400'

type GridTableContextValue<TItem> = {
  items: readonly TItem[]
  columns: readonly GridColumn<TItem>[]
  columnMap: Map<string, GridColumn<TItem>>
  totalColumns: number
  getRowKey: (item: TItem, index: number) => string
  defaultHeaderCellClassName?: string
  defaultCellClassName?: string
  sort?: SortState<TItem> | null
  setSort?: (sort: SortState<TItem>) => void
  page?: number
  totalPages?: number
  setPage?: (page: number) => void
}

const GridTableContext = createContext<GridTableContextValue<unknown> | null>(null)


function formatFieldName(fieldName: string): string {
  return fieldName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase())
}

function getColumnKey<TItem>(column: GridColumn<TItem>): string {
  const key = column.key ?? (column.field as string | undefined)
  if (!key) throw new Error('GridColumn must specify field or key.')
  return key
}

function getColumnHeader<TItem>(column: GridColumn<TItem>): ReactNode {
  if (column.header !== undefined) return column.header
  const fieldName = column.field ?? column.key
  if (!fieldName) return ''
  return formatFieldName(fieldName)
}

function getGridColumnsClassName(totalColumns: number) {
  return gridColumnsClassNames[totalColumns]
}

function getColumnSpanClassName(span: number) {
  return columnSpanClassNames[span]
}

function getColumnSpan<TItem = unknown>(column: GridColumn<TItem>) {
  return column.span ?? 1
}

function getAlignmentClassName(align: ColumnAlign | undefined) {
  if (!align) {
    return undefined
  }

  return alignmentClassNames[align]
}

function useGridTableContext<TItem>() {
  const contextValue = useContext(GridTableContext)

  if (!contextValue) {
    throw new Error('GridTable compound components must be used inside GridTable.')
  }

  return contextValue as GridTableContextValue<TItem>
}

function getRequiredGridColumnsClassName(totalColumns: number) {
  const totalColumnsClassName = getGridColumnsClassName(totalColumns)

  if (!totalColumnsClassName) {
    throw new Error(`Unsupported totalColumns value: ${totalColumns}. Supported range: 1-12.`)
  }

  return totalColumnsClassName
}

function getRequiredColumnSpanClassName<TItem = unknown>(column: GridColumn<TItem>) {
  const span = getColumnSpan(column)
  const spanClassName = getColumnSpanClassName(span)

  if (!spanClassName) {
    throw new Error(`Unsupported span value for column ${getColumnKey(column)}: ${span}. Supported range: 1-12.`)
  }

  return spanClassName
}


type HeaderCellContentProps<TItem> = {
  column: GridColumn<TItem>
  columnIndex: number
  sort: SortState<TItem> | null
  isSortable: boolean
  isActive: boolean
  renderHeaderCell?: (column: GridColumn<TItem>, columnIndex: number) => ReactNode
}

function HeaderCellContent<TItem>({ column, columnIndex, sort, isSortable, isActive, renderHeaderCell }: HeaderCellContentProps<TItem>) {
  if (typeof column.customHeader === 'function') {
    return column.customHeader(column, columnIndex)
  }

  if (column.customHeader !== undefined) {
    return column.customHeader
  }

  const headerOverride = renderHeaderCell?.(column, columnIndex)
  if (headerOverride !== undefined) return headerOverride

  const hoverOrder = (column as GridColumnWithField<TItem>).initialSortOrder ?? 'asc'
  return (
    <span className="inline-flex items-center gap-1.5">
      {getColumnHeader(column)}
      {isActive
        ? <FontAwesomeIcon icon={sort!.order === 'asc' ? faArrowUp : faArrowDown} className="text-xs" aria-hidden />
        : isSortable && <FontAwesomeIcon icon={hoverOrder === 'asc' ? faArrowUp : faArrowDown} className="text-xs opacity-0 group-hover:opacity-40 transition-opacity" aria-hidden />
      }
    </span>
  )
}

export function GridTableHeader<TItem = unknown>({ className, renderHeaderCell }: GridTableHeaderProps<TItem>) {
  const { totalColumns, columns, defaultHeaderCellClassName, sort, setSort } = useGridTableContext<TItem>()
  const totalColumnsClassName = getRequiredGridColumnsClassName(totalColumns)
  
  const handleHeaderClick = useCallback((column: GridColumn<TItem>) => {
    if (!setSort || !column.field) return
    if (sort && sort.field === column.field) {
      setSort({ field: column.field, order: sort.order === 'asc' ? 'desc' : 'asc' })
    } else {
      setSort({ field: column.field, order: (column as GridColumnWithField<TItem>).initialSortOrder ?? 'asc' })
    }
  }, [sort, setSort])

  return (
    <div className={clsx(defaultRowLayoutClassName, totalColumnsClassName, className)}>
      {columns.map((column, columnIndex) => {
        const spanClassName = getRequiredColumnSpanClassName(column)
        const columnKey = getColumnKey(column)
        const isSortable = !!column.field && !!setSort
        const isActive = isSortable && sort?.field === column.field

        return (
          <div
            key={columnKey}
            className={clsx(
              spanClassName,
              getAlignmentClassName(column.align),
              defaultHeaderCellClassName,
              column.headerClassName,
              isSortable ? 'cursor-pointer select-none group' : undefined,
            )}
            onClick={isSortable ? () => handleHeaderClick(column) : undefined}
            role={isSortable ? 'button' : undefined}
            tabIndex={isSortable ? 0 : undefined}
            onKeyDown={isSortable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleHeaderClick(column) } : undefined}
            aria-sort={isActive ? (sort!.order === 'asc' ? 'ascending' : 'descending') : undefined}
          >
            <HeaderCellContent
              column={column}
              columnIndex={columnIndex}
              sort={sort ?? null}
              isSortable={isSortable}
              isActive={isActive}
              renderHeaderCell={renderHeaderCell}
            />
          </div>
        )
      })}
    </div>
  )
}

type RowCellContentProps<TItem> = {
  column: GridColumn<TItem>
  item: TItem
  index: number
  renderCell?: (column: GridColumn<TItem>, item: TItem, index: number) => ReactNode
}

function RowCellContent<TItem>({ column, item, index, renderCell }: RowCellContentProps<TItem>) {
  if (typeof column.customCell === 'function') {
    return column.customCell(item, column, index)
  }

  if (column.customCell !== undefined) {
    return column.customCell
  }

  const custom = renderCell?.(column, item, index)

  if (custom !== undefined) return custom

  const itemRecord = item as Record<string, unknown>
  if (column.field && column.field in itemRecord) {
    const value = itemRecord[column.field]
    const formatter = (column as GridColumnWithField<TItem>).valueFormatter
    return formatter ? formatter(value, item) : String(value ?? '')
  }

  return null
}

export function GridTableRows<TItem>({ className, renderCell }: GridTableRowsProps<TItem>) {
  const { items, columns, totalColumns, getRowKey, defaultCellClassName, page, totalPages, setPage } = useGridTableContext<TItem>()
  const totalColumnsClassName = getRequiredGridColumnsClassName(totalColumns)

  const sentinelRef = useRef<HTMLDivElement>(null)

  const pageRef = useRef(page)
  const totalPagesRef = useRef(totalPages)

  useEffect(() => {
    pageRef.current = page
    totalPagesRef.current = totalPages
  })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !setPage || page === undefined) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const current = pageRef.current ?? 1
        if(current < (totalPagesRef.current ?? 1)) {
          observer.disconnect() // Prevent multiple triggers while loading
          setPage(current + 1)
        }
      }
    }, { threshold: 0.1 })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [items, setPage])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {items.map((item, index) => (
        <div
          key={getRowKey(item, index)}
          className={clsx(defaultRowLayoutClassName, totalColumnsClassName, className)}
        >
          {columns.map((column) => {
            const spanClassName = getRequiredColumnSpanClassName(column)
            const columnKey = getColumnKey(column)

            return (
              <div
                key={columnKey}
                className={clsx(spanClassName, getAlignmentClassName(column.align), defaultCellClassName, column.cellClassName)}
              >
                <RowCellContent column={column} item={item} index={index} renderCell={renderCell} />
              </div>
            )
          })}
        </div>  
      ))}
      <div ref={sentinelRef} className="h-1" />
    </div>
   )
}

export function GridTableRow({ className, children }: GridTableRowProps) {
  const { totalColumns } = useGridTableContext<unknown>()
  const totalColumnsClassName = getRequiredGridColumnsClassName(totalColumns)

  return (
    <div className={clsx(defaultRowLayoutClassName, totalColumnsClassName, className)}>
      {children}
    </div>
  )
}

export function GridTableCell({ columnKey, className, children }: GridTableCellProps) {
  const { columnMap, defaultCellClassName } = useGridTableContext<unknown>()
  const column = columnMap.get(columnKey)

  if (!column) {
    throw new Error(`Unknown column key: ${columnKey}.`)
  }

  const spanClassName = getRequiredColumnSpanClassName(column)

  return (
    <div className={clsx(spanClassName, getAlignmentClassName(column.align), defaultCellClassName, column.cellClassName, className)}>
      {children}
    </div>
  )
}

export function GridTableRoot<TItem>({
  items,
  columns,
  sort,
  onSortChange,
  totalColumns,
  getRowKey,
  children,
  emptyState,
  containerClassName,
  bodyClassName,
  defaultHeaderCellClassName = headerCellClassName,
  defaultCellClassName = cellClassName,
  validateSpans = true,
  headerClassName = defaultHeaderClassName,
  renderHeaderCell,
  rowClassName = defaultRowHeightClassName,
  renderCell,
  page,
  totalPages,
  onPageChange,
}: GridTableProps<TItem>) { 

  if (validateSpans && process.env.NODE_ENV !== 'production') {
    const { valid, spanTotal } = validateColumnSpans(columns, totalColumns)
    if (!valid) throw new Error(`Column spans must total ${totalColumns}, received ${spanTotal}.`)
  }

  const columnMap = useMemo(
    () => new Map(columns.map((col) => [getColumnKey(col), col])),
    [columns]
  )

  const resolvedEmptyState = emptyState ?? (
    <div className={defaultEmptyStateClassName}>
      <div className={defaultEmptyStateMessageClassName}>
        No data available.
      </div>
    </div>
  )

  return (
    // React context cannot carry a generic type parameter directly.
    // TItem is re-applied by the typed useGridTableContext<TItem>() hook at each call site.
    <GridTableContext.Provider value={{ items, columns, columnMap, totalColumns, getRowKey, defaultHeaderCellClassName, defaultCellClassName, sort, setSort: onSortChange, page, totalPages, setPage: onPageChange } as unknown as GridTableContextValue<unknown>}
    >
      <div
        className={clsx(
          defaultContainerClassName,
          containerClassName,
        )}
      >
        <div className={clsx(defaultBodyClassName, bodyClassName)}>
          {children ? (
            children
          ) : (
            <>
              <GridTableHeader<TItem> className={headerClassName} renderHeaderCell={renderHeaderCell} />
              <GridTableRows className={rowClassName} renderCell={renderCell} />
            </>
          )}

          {items.length === 0 && resolvedEmptyState}
        </div>
      </div>
    </GridTableContext.Provider>
  )
}

type GridTableComponent = typeof GridTableRoot & {
  Header: typeof GridTableHeader
  Rows: typeof GridTableRows
  Row: typeof GridTableRow
  Cell: typeof GridTableCell
}

Object.assign(GridTableRoot, {
  Header: GridTableHeader,
  Rows: GridTableRows,
  Row: GridTableRow,
  Cell: GridTableCell,
})

export const GridTable = GridTableRoot as GridTableComponent

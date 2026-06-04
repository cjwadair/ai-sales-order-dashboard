import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GridTable, type GridColumn } from './GridTable'

afterEach(() => {
  cleanup()
})

type TestItem = {
  id: string
  first: string
  second: string
}

const testColumns: readonly GridColumn<TestItem>[] = [
  {
    field: 'first',
    span: 1,
    headerClassName: 'px-2 py-1 font-medium',
    cellClassName: 'px-2 py-1',
  },
  {
    field: 'second',
    span: 2,
    headerClassName: 'px-2 py-1 font-medium',
    cellClassName: 'px-2 py-1',
  },
]

describe('GridTable', () => {
  it('defaults missing column span to 1', () => {
    const items: TestItem[] = [{ id: '1', first: 'A', second: 'B' }]
    const columns: readonly GridColumn<TestItem>[] = [
      {
        field: 'first',
      },
      {
        field: 'second',
      },
    ]

    render(
      <GridTable
        items={items}
        columns={columns}
        totalColumns={2}
        getRowKey={(item) => item.id}
      />,
    )

    expect(screen.getByText('First').closest('div')).toHaveClass('col-span-1')
    expect(screen.getByText('Second').closest('div')).toHaveClass('col-span-1')
  })

  it('applies default header and cell classes with column overrides', () => {
    const items: TestItem[] = [{ id: '1', first: 'A', second: 'B' }]
    const columns: readonly GridColumn<TestItem>[] = [
      {
        field: 'first',
        span: 1,
      },
      {
        field: 'second',
        span: 2,
        headerClassName: 'px-8',
        cellClassName: 'font-semibold',
      },
    ]

    render(
      <GridTable
        items={items}
        columns={columns}
        totalColumns={3}
        getRowKey={(item) => item.id}
        headerClassName="bg-neutral-100"
        rowClassName="border-t border-neutral-200"
        defaultHeaderCellClassName="px-2 py-1"
        defaultCellClassName="text-neutral-700"
      />,
    )

    expect(screen.getByText('First').closest('div')).toHaveClass('px-2', 'py-1')
    expect(screen.getByText('Second').closest('div')).toHaveClass('px-2', 'py-1', 'px-8')
    expect(screen.getByText('A').closest('div')).toHaveClass('text-neutral-700')
    expect(screen.getByText('B').closest('div')).toHaveClass('text-neutral-700', 'font-semibold')
  })

  it('renders row values by field when provided', () => {
    const items: TestItem[] = [{ id: '1', first: 'A', second: 'B' }]

    render(
      <GridTable
        items={items}
        columns={testColumns}
        totalColumns={3}
        getRowKey={(item) => item.id}
        headerClassName="bg-neutral-100"
        rowClassName="border-t border-neutral-200"
      />,
    )

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('renders with configured total columns and col spans', () => {
    const items: TestItem[] = [{ id: '1', first: 'A', second: 'B' }]

    render(
      <GridTable
        items={items}
        columns={testColumns}
        totalColumns={3}
        getRowKey={(item) => item.id}
      >
        <GridTable.Header className="bg-neutral-100" />
        <GridTable.Rows<TestItem>
          className="border-t border-neutral-200"
          renderCell={(column, item) => {
            if (column.field === 'first') return item.first
            if (column.field === 'second') return item.second
            return null
          }}
        />
      </GridTable>,
    )

    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('First').closest('div')).toHaveClass('col-span-1')
    expect(screen.getByText('Second').closest('div')).toHaveClass('col-span-2')
  })

  it('throws when column span total does not equal totalColumns', () => {
    const items: TestItem[] = [{ id: '1', first: 'A', second: 'B' }]

    expect(() => {
      render(
        <GridTable
          items={items}
          columns={testColumns}
          totalColumns={4}
          getRowKey={(item) => item.id}
        >
          <GridTable.Header />
          <GridTable.Rows<TestItem>
            renderCell={(column, item) => {
              if (column.field === 'first') return item.first
              if (column.field === 'second') return item.second
              return null
            }}
          />
        </GridTable>,
      )
    }).toThrow('Column spans must total 4, received 3.')
  })
})

import { describe, expect, it } from 'vitest'
import { recommendView } from './recommendView'
import type { ReportColumn, ReportRow } from '../api/reportEnvelope'

// ── helpers ──────────────────────────────────────────────────────────────────

function col(name: string, type: ReportColumn['type']): ReportColumn {
  return { name, type }
}

function rows(n: number): ReportRow[] {
  return Array.from({ length: n }, (_, i) => ({ i }))
}

const ONE = rows(1)
const MANY = rows(5)
const NONE = rows(0)

// ── Rule 1: KPI ───────────────────────────────────────────────────────────────

describe('kpi', () => {
  it('returns kpi for 1 row × 1 decimal measure × 0 dims', () => {
    expect(recommendView([col('revenue', 'decimal')], ONE)).toBe('kpi')
  })

  it('returns kpi for 1 row × 1 integer measure × 0 dims', () => {
    expect(recommendView([col('count', 'integer')], ONE)).toBe('kpi')
  })

  it('does not return kpi when data has 0 rows', () => {
    expect(recommendView([col('revenue', 'decimal')], NONE)).not.toBe('kpi')
  })

  it('does not return kpi when data has >1 rows', () => {
    expect(recommendView([col('revenue', 'decimal')], MANY)).not.toBe('kpi')
  })

  it('does not return kpi when there is a dimension present', () => {
    const cols = [col('rep', 'string'), col('revenue', 'decimal')]
    expect(recommendView(cols, ONE)).not.toBe('kpi')
  })

  it('does not return kpi when there are multiple measures', () => {
    const cols = [col('revenue', 'decimal'), col('count', 'integer')]
    expect(recommendView(cols, ONE)).not.toBe('kpi')
  })
})

// ── Rule 2: Line ──────────────────────────────────────────────────────────────

describe('line', () => {
  it('returns line for 1 date dim + 1 measure', () => {
    expect(recommendView([col('month', 'date'), col('revenue', 'decimal')], MANY)).toBe('line')
  })

  it('returns line for 1 date dim + multiple measures', () => {
    const cols = [col('month', 'date'), col('revenue', 'decimal'), col('orders', 'integer')]
    expect(recommendView(cols, MANY)).toBe('line')
  })

  it('returns line for multiple date dims + 1 measure', () => {
    const cols = [col('year', 'date'), col('month', 'date'), col('revenue', 'decimal')]
    expect(recommendView(cols, MANY)).toBe('line')
  })

  it('returns line even with 1 row when a date dim is present', () => {
    // KPI rule requires 0 dims — date dim disqualifies it; line fires instead
    expect(recommendView([col('month', 'date'), col('revenue', 'decimal')], ONE)).toBe('line')
  })

  it('does not return line when date dim has no measures', () => {
    expect(recommendView([col('month', 'date')], MANY)).not.toBe('line')
  })
})

// ── Rule 3: Bar ───────────────────────────────────────────────────────────────

describe('bar', () => {
  it('returns bar for 1 string dim + 1 measure', () => {
    expect(recommendView([col('rep', 'string'), col('revenue', 'decimal')], MANY)).toBe('bar')
  })

  it('returns bar for 1 enum dim + 1 measure', () => {
    expect(recommendView([col('status', 'enum'), col('count', 'integer')], MANY)).toBe('bar')
  })

  it('returns bar for 1 categorical dim + multiple measures', () => {
    const cols = [col('rep', 'string'), col('revenue', 'decimal'), col('orders', 'integer')]
    expect(recommendView(cols, MANY)).toBe('bar')
  })

  it('does not return bar for 2 categorical dims + 1 measure', () => {
    const cols = [col('rep', 'string'), col('region', 'string'), col('revenue', 'decimal')]
    expect(recommendView(cols, MANY)).not.toBe('bar')
  })

  it('does not return bar for 1 categorical dim + 0 measures', () => {
    expect(recommendView([col('rep', 'string')], MANY)).not.toBe('bar')
  })

  it('does not return bar for 1 date dim + 1 measure (line takes precedence)', () => {
    expect(recommendView([col('month', 'date'), col('revenue', 'decimal')], MANY)).not.toBe('bar')
  })
})

// ── Rule 4: List ──────────────────────────────────────────────────────────────

describe('list', () => {
  it('returns list for 1 string dim + 0 measures', () => {
    expect(recommendView([col('rep', 'string')], MANY)).toBe('list')
  })

  it('returns list for 1 date dim + 0 measures', () => {
    expect(recommendView([col('month', 'date')], MANY)).toBe('list')
  })

  it('returns list for 1 enum dim + 0 measures', () => {
    expect(recommendView([col('status', 'enum')], MANY)).toBe('list')
  })

  it('does not return list for 2 dims + 0 measures', () => {
    expect(recommendView([col('rep', 'string'), col('region', 'string')], MANY)).not.toBe('list')
  })

  it('does not return list when measures are present', () => {
    expect(recommendView([col('rep', 'string'), col('revenue', 'decimal')], MANY)).not.toBe('list')
  })
})

// ── Rule 5: Table (fallthrough) ───────────────────────────────────────────────

describe('table (fallthrough)', () => {
  it('returns table for empty columns', () => {
    expect(recommendView([], MANY)).toBe('table')
  })

  it('returns table for 0 dims + 0 measures', () => {
    expect(recommendView([], NONE)).toBe('table')
  })

  it('returns table for 0 dims + multiple measures (no grouping key)', () => {
    const cols = [col('revenue', 'decimal'), col('cost', 'decimal')]
    expect(recommendView(cols, MANY)).toBe('table')
  })

  it('returns table for 2 categorical dims + 1 measure', () => {
    const cols = [col('rep', 'string'), col('region', 'string'), col('revenue', 'decimal')]
    expect(recommendView(cols, MANY)).toBe('table')
  })

  it('returns table for 2 dims + 0 measures', () => {
    const cols = [col('rep', 'string'), col('region', 'string')]
    expect(recommendView(cols, MANY)).toBe('table')
  })

  it('returns table for 1 measure + 0 dims + 0 rows', () => {
    expect(recommendView([col('revenue', 'decimal')], NONE)).toBe('table')
  })

  it('returns table for 1 measure + 0 dims + many rows', () => {
    expect(recommendView([col('revenue', 'decimal')], MANY)).toBe('table')
  })
})

// ── Pie is never auto-recommended ─────────────────────────────────────────────

describe('pie never auto-recommended', () => {
  it('never returns pie for any combination', () => {
    const cases: [ReportColumn[], ReportRow[]][] = [
      [[col('rep', 'string'), col('revenue', 'decimal')], MANY],
      [[col('rep', 'string'), col('revenue', 'decimal')], rows(3)],
      [[col('rep', 'string'), col('revenue', 'decimal')], ONE],
      [[col('revenue', 'decimal')], ONE],
      [[col('month', 'date'), col('revenue', 'decimal')], MANY],
    ]
    for (const [columns, data] of cases) {
      expect(recommendView(columns, data)).not.toBe('pie')
    }
  })
})

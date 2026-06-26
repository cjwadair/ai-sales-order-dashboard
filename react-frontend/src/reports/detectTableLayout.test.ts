import { describe, it, expect } from 'vitest'
import { detectTableLayout } from './detectTableLayout'
import type { ReportColumn } from '../api/reportEnvelope'

const str = (name: string): ReportColumn => ({ name, type: 'string' })
const dec = (name: string): ReportColumn => ({ name, type: 'decimal' })
const int = (name: string): ReportColumn => ({ name, type: 'integer' })
const date = (name: string): ReportColumn => ({ name, type: 'date' })

describe('detectTableLayout — using spec arrays', () => {
  it('returns detail when no measures', () => {
    expect(detectTableLayout({ dimensions: [{}], measures: [] }, [])).toBe('detail')
  })

  it('returns detail when 0 dims + 0 measures (filter-only fallback)', () => {
    expect(detectTableLayout({ dimensions: [], measures: [] }, [])).toBe('detail')
  })

  it('returns detail when many dims + 0 measures', () => {
    expect(detectTableLayout({ dimensions: [{}, {}, {}], measures: [] }, [])).toBe('detail')
  })

  it('returns summary when 0 dims + 1 measure', () => {
    expect(detectTableLayout({ dimensions: [], measures: [{}] }, [])).toBe('summary')
  })

  it('returns summary when 1 dim + 1 measure', () => {
    expect(detectTableLayout({ dimensions: [{}], measures: [{}] }, [])).toBe('summary')
  })

  it('returns summary when 1 dim + multiple measures', () => {
    expect(detectTableLayout({ dimensions: [{}], measures: [{}, {}] }, [])).toBe('summary')
  })

  it('returns grouped when 2 dims + 1 measure', () => {
    expect(detectTableLayout({ dimensions: [{}, {}], measures: [{}] }, [])).toBe('grouped')
  })

  it('returns grouped when 3 dims + 2 measures', () => {
    expect(detectTableLayout({ dimensions: [{}, {}, {}], measures: [{}, {}] }, [])).toBe('grouped')
  })
})

describe('detectTableLayout — missing spec arrays default to detail', () => {
  it('returns detail when spec has no arrays at all', () => {
    expect(
      detectTableLayout({}, [str('order_number'), str('customer'), date('order_date')]),
    ).toBe('detail')
  })

  it('returns detail when spec has measures array but no dimensions array', () => {
    expect(detectTableLayout({ measures: [] }, [str('order_number'), dec('total')])).toBe('detail')
  })

  it('returns detail when spec has dimensions array but no measures array', () => {
    expect(detectTableLayout({ dimensions: [{}] }, [str('sales_rep'), dec('total')])).toBe('detail')
  })

  it('returns detail even when columns include decimal types (cannot infer aggregation from type alone)', () => {
    // order_total declared as a dimension looks the same as a measure at the column-type level
    expect(detectTableLayout({}, [str('sales_rep'), dec('order_total')])).toBe('detail')
  })

  it('returns detail even when columns are all numeric', () => {
    expect(detectTableLayout({}, [dec('total'), int('count')])).toBe('detail')
  })
})

describe('detectTableLayout — spec takes precedence over columns', () => {
  it('trusts spec dim count over column count when spec has arrays', () => {
    // spec says 1 dim → summary; columns say 2 dims → would be grouped
    expect(
      detectTableLayout({ dimensions: [{}], measures: [{}] }, [str('a'), str('b'), dec('total')]),
    ).toBe('summary')
  })

  it('trusts spec measure count over column count', () => {
    // spec says 0 measures → detail; columns have a decimal → would be summary
    expect(
      detectTableLayout({ dimensions: [{}], measures: [] }, [str('a'), dec('total')]),
    ).toBe('detail')
  })
})

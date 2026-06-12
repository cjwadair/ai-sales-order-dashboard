import { renderHook, act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReportQuery, type ReportEnvelope } from './useReportQuery'

const envelope: ReportEnvelope = {
  spec: { source: 'order' },
  title: 'Sales by rep',
  data: [{ rep: 'Alice', revenue: '150.00' }],
  columns: [
    { name: 'rep', type: 'string' },
    { name: 'revenue', type: 'decimal' },
  ],
  meta: { row_count: 1, truncated: false, unsupported_note: null },
}

function mockOk(body: unknown = envelope) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useReportQuery', () => {
  it('posts the query to the reports endpoint and returns the envelope', async () => {
    const fetchMock = mockOk()
    const { result } = renderHook(() => useReportQuery())

    let returned: ReportEnvelope | undefined
    await act(async () => {
      returned = await result.current.runQuery('sales by rep')
    })

    expect(returned).toEqual(envelope)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/reports/query', expect.objectContaining({ method: 'POST' }))
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent).toEqual({ query: 'sales by rep', history: [] })
  })

  it('threads the prior turn into the next request as history', async () => {
    const fetchMock = mockOk()
    const { result } = renderHook(() => useReportQuery())

    await act(async () => {
      await result.current.runQuery('sales by rep')
    })
    await act(async () => {
      await result.current.runQuery('now just completed ones')
    })

    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(secondBody.history).toEqual([{ query: 'sales by rep', spec: envelope.spec }])
    expect(result.current.hasHistory).toBe(true)
  })

  it('surfaces the error envelope message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ error: { code: 'validation_failed', message: 'bad query' } }),
      }),
    )
    const { result } = renderHook(() => useReportQuery())

    await act(async () => {
      await expect(result.current.runQuery('nonsense')).rejects.toThrow('bad query')
    })

    expect(result.current.error).toBe('bad query')
    expect(result.current.hasHistory).toBe(false)
  })

  it('surfaces a clean error when the envelope fails schema validation', async () => {
    mockOk({ spec: {}, title: null, data: [], columns: [], meta: { truncated: false } })
    const { result } = renderHook(() => useReportQuery())

    await act(async () => {
      await expect(result.current.runQuery('anything')).rejects.toThrow(
        'Unexpected response from the report service',
      )
    })

    expect(result.current.error).toBe('Unexpected response from the report service')
    expect(result.current.hasHistory).toBe(false)
  })

  it('preserves decimal string values without precision loss', async () => {
    const decimalEnvelope: ReportEnvelope = {
      ...envelope,
      data: [{ rep: 'Alice', revenue: '9007199254740993.99' }],
    }
    mockOk(decimalEnvelope)
    const { result } = renderHook(() => useReportQuery())

    let returned: ReportEnvelope | undefined
    await act(async () => {
      returned = await result.current.runQuery('large decimal')
    })

    expect((returned!.data[0] as Record<string, unknown>).revenue).toBe('9007199254740993.99')
  })
})

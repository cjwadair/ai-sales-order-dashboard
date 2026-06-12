import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { ViewProps } from '../types'
import { formatValue, formatColumnName } from '../format'
import { PALETTE, isMeasure, toChartData } from './chartUtils'

export function BarView({ data, columns }: ViewProps) {
  const dimCol = columns.find(c => !isMeasure(c))
  const measures = columns.filter(isMeasure)

  if (!dimCol || measures.length === 0 || data.length === 0) {
    return <div className="py-8 text-center text-sm text-neutral-400">No rows matched</div>
  }

  const chartData = toChartData(data, dimCol, measures)
  const primaryMeasure = measures[0]

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="_x" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={v => formatValue(v as number, primaryMeasure.type)}
          tick={{ fontSize: 12 }}
          width={72}
        />
        <Tooltip
          formatter={(value, name) => {
            const col = measures.find(m => m.name === String(name))
            return [
              col ? formatValue(value as number, col.type) : String(value),
              col ? formatColumnName(col.name) : String(name),
            ]
          }}
        />
        {measures.length > 1 && (
          <Legend formatter={name => formatColumnName(String(name))} />
        )}
        {measures.map((m, i) => (
          <Bar
            key={m.name}
            dataKey={m.name}
            fill={PALETTE[i % PALETTE.length]}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

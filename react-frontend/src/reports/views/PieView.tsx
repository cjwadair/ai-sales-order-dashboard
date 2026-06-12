import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  type PieLabelRenderProps,
} from 'recharts'
import type { ViewProps } from '../types'
import { formatValue, formatColumnName } from '../format'
import { PALETTE, isMeasure } from './chartUtils'

export function PieView({ data, columns }: ViewProps) {
  const dimCol = columns.find(c => !isMeasure(c))
  const measureCol = columns.find(isMeasure)

  if (!dimCol || !measureCol || data.length === 0) {
    return <div className="py-8 text-center text-sm text-neutral-400">No rows matched</div>
  }

  const chartData = data
    .map(row => ({
      name: formatValue(row[dimCol.name], dimCol.type),
      value: row[measureCol.name] === null ? 0 : Number(row[measureCol.name]),
    }))
    .filter(d => d.value > 0)

  if (chartData.length === 0) {
    return <div className="py-8 text-center text-sm text-neutral-400">No rows matched</div>
  }

  const measureLabel = formatColumnName(measureCol.name)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={110}
          label={({ name, percent }: PieLabelRenderProps) =>
            name ? `${name} (${((percent ?? 0) * 100).toFixed(0)}%)` : ''
          }
          labelLine={false}
        >
          {chartData.map((_entry, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [
            formatValue(value as number, measureCol.type),
            measureLabel,
          ]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

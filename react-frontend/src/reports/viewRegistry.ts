import type { ComponentType } from 'react'
import type { ViewType, ViewProps } from './types'
import { TableView } from './views/TableView'
import { BarView } from './views/BarView'
import { LineView } from './views/LineView'
import { PieView } from './views/PieView'
import { KpiView } from './views/KpiView'
import { ListView } from './views/ListView'

export type { ViewType, ViewProps }

export const viewRegistry: Record<ViewType, ComponentType<ViewProps>> = {
  table: TableView,
  bar: BarView,
  line: LineView,
  pie: PieView,
  kpi: KpiView,
  list: ListView,
}

import { useEffect, useState } from 'react'

type FilterOptions = {
  salesReps: string[]
  customers: string[]
  warehouses: string[]
}

export function useFilterOptions(){
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ salesReps: [], customers: [], warehouses: [] })
    
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/v1/filter_options', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch filter options: ${res.status}`)
        return res.json() as Promise<{ sales_reps: string[]; customers: string[]; warehouses: string[] }>
      })
      .then((json) => setFilterOptions({ salesReps: json.sales_reps, customers: json.customers, warehouses: json.warehouses }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Ignore abort errors which are expected during cleanup
          return
        }
        console.error(err)
      })  

    return () => { controller.abort() }
  }, [])
  
  return filterOptions
}
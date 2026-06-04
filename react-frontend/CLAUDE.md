# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Type-check + production build
npm run lint         # ESLint
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run
npm run format       # Prettier write
npm run format:check # Prettier check
```

## Architecture

React 19 + TypeScript SPA. No global state library — all state lives in `OrdersPage.tsx` via `useState`/`useMemo`. Styling with Tailwind CSS v4. Routing via React Router v7.

**Top-level structure:**

```
App.tsx                   → router (/ redirects to /orders, * → NotFoundPage)
src/pages/OrdersPage.tsx  → main business logic: filter state, column definitions
src/components/
  GridTable.tsx           → generic reusable data table
  FilterBar.tsx           → filter orchestration
  SearchInput.tsx
  DropdownFilter.tsx
  DateRangeFilter.tsx
  AddFilterButton.tsx
```

### GridTable

`GridTable<TItem>` is the central abstraction. It uses a **compound component pattern** — the root component provides context via `useGridTableContext()`, and sub-components (`GridTable.Header`, `GridTable.Rows`, `GridTable.Row`, `GridTable.Cell`) consume it.

Column definitions use the generic type `GridColumn<TItem>`, supporting custom renderers, alignment, and column spanning. Layout is CSS Grid (not flexbox). Sorting state is typed as `SortState<TItem>`.

### FilterBar

`FilterBar` accepts a `FilterConfig[]` array that discriminates on a `type` field (`"search"` | `"dateRange"` | `"dropdown"`). Filters are split into `fixed` (always visible) and `additional` (user-activated via `AddFilterButton`). The parent (`OrdersPage`) owns all filter values and passes callbacks down.

### TypeScript conventions

- Generic types throughout: `GridColumn<TItem>`, `SortState<TItem>`
- Discriminated unions for filter configs
- Strict mode: `noUnusedLocals` and `noUnusedParameters` enforced

### Styling conventions

- Custom Tailwind color tokens: `brand-*`, `accent-*`
- Dark mode toggled via `documentElement` class; components use `dark:` variants
- Default class name constants defined per component for consistency; overridable via `className` prop

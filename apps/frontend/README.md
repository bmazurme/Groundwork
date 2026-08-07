# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## TanStack

Two TanStack libraries do the data/UI heavy lifting — no hand-rolled fetch-and-`useState` or table logic:

- **[TanStack Query](https://tanstack.com/query)** (`@tanstack/react-query`) — all server state. [App.tsx](src/App.tsx) runs `useQuery` for backend health (`refetchInterval: 15000`) and the documents list, with a dynamic `refetchInterval` that polls every 2s *only* while a document is `pending`/`indexing` and stops once everything settles — no separate WebSocket/polling logic to maintain. Upload and delete are `useMutation`s that `invalidateQueries(['documents'])` on success, so the table refreshes itself; [SearchPanel.tsx](src/components/SearchPanel.tsx) runs search as a `useMutation` (a query would need a stable cache key strategy for arbitrary free-text input, which a one-shot mutation on submit sidesteps) and its states (`isPending`/`isError`/`isIdle`) drive the loading/error/empty-result UI directly. [DocumentViewerDialog.tsx](src/components/DocumentViewerDialog.tsx) fetches a document's chunks via `useQuery` keyed on `['document-chunks', documentId]`, gated with `enabled: documentId !== null` so nothing fetches until the dialog actually opens.
- **[TanStack Table](https://tanstack.com/table)** (`@tanstack/react-table`) — the document library table in [DocumentsTable.tsx](src/components/DocumentsTable.tsx). Headless: it only supplies row/column state machinery (`getSortedRowModel`, `getPaginationRowModel`), all markup is plain `<table>`/Gravity UI elements via `flexRender`. Column sort is click-to-toggle on the header (`getToggleSortingHandler`); format/status filtering is done by pre-filtering the source array before it reaches the table rather than TanStack's own column-filter APIs, since two independent multi-select dropdowns were simpler to reason about as plain component state than as `columnFilters` entries; pagination is fixed at 8 rows/page via controlled `pagination` state, with prev/next controls hidden entirely when everything fits on one page.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

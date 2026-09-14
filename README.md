# mabigfam

A small family-tree app: a Fastify + TypeScript + Prisma API backed by
SQLite, and a React + TypeScript frontend with a sortable/filterable table
view and a genealogy tree view (built on
[`relatives-tree`](https://www.npmjs.com/package/relatives-tree) /
[`react-family-tree`](https://www.npmjs.com/package/react-family-tree), which
handle the multi-parent layout case a plain recursive tree struggles with).

## Structure

- [`prisma/schema.prisma`](prisma/schema.prisma) — `FamilyMember` and
  `ParentChild` models, SQLite datasource.
- [`server/`](server) — Fastify API. CRUD for members, parent/child link
  management (with cycle prevention), and routes that resolve a member's (or
  the whole tree's) relations for the UI.
- [`web/`](web) — Vite + React frontend. Table view, member detail view
  (edit fields, manage parent/child links), and tree view.

## Requirements

- Node.js 20+

## Setup

```bash
npm install
npm run prisma:migrate
```

This creates `prisma/mabigfam.db` and applies the schema. Re-run
`npm run prisma:migrate` whenever `prisma/schema.prisma` changes.

## Development

```bash
npm run dev
```

Runs the API on http://localhost:3001 and the web app on
http://localhost:5173 (which proxies `/api` to the server — see
[`web/vite.config.ts`](web/vite.config.ts)) concurrently. Or run them
separately with `npm run dev:server` / `npm run dev:web`.

## Build

```bash
npm run build
```

## Notes / known limitations

- `FamilyMember` has no `gender` or explicit spouse relation in the schema.
  The tree view derives siblings (share a parent) and spouses (share a
  child) from `ParentChild` data alone — see
  [`web/src/lib/buildRelativesTree.ts`](web/src/lib/buildRelativesTree.ts).
  Adding real `gender`/spouse fields later would make that inference exact
  instead of heuristic.
- Prisma is pinned to the 6.x line: Prisma 7 removed the classic
  `datasource { url = "..." }` form used in `schema.prisma` in favor of a
  `prisma.config.ts` + driver-adapter setup, which would mean rewriting the
  schema this project shipped with.

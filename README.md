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
- `npm audit` reports 2 accepted-risk findings that only a breaking major
  upgrade would clear, both low-impact for this app: a stack-exhaustion DoS
  in `deepmerge-ts`, pulled in by the Prisma **CLI's** own config loader
  (not a runtime dependency — fixed only by Prisma 8, see above), and two
  moderate `react-router` advisories fixed only in React Router v7 (a
  breaking API migration) — one is an SSR hydration issue that doesn't apply
  here (this app is a client-only SPA), the other an open-redirect in
  `<Link>`/`useNavigate` that requires navigating to attacker-controlled
  paths, which this app never does. Don't run `npm audit fix --force`
  reflexively: in this npm-workspaces layout it has previously misattributed
  hoisted deps into the wrong workspace's `package.json` (e.g. adding
  `fastify` to `web` and `vite`/`react-router-dom` to `server`).

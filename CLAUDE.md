# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

mabigfam is a family-tree app for sharing member info, a genealogy tree, a
shared calendar, and a photo-guessing game with an extended family. npm
workspaces monorepo: `server/` (Fastify API + SQLite via Prisma) and `web/`
(React + Vite, Tailwind 4 with a Catppuccin palette), sharing
`prisma/schema.prisma` at the root. See `README.md` for the full feature
list, theming approach, and security/deployment notes — it's kept current
and is the primary reference; this file covers what a first read of the code
won't make obvious.

## Commands

```bash
npm install                          # root install; workspaces + patches/ (postinstall)
npm run prisma:migrate               # create/update prisma/mabigfam.db
npm run dev                          # server :3001 + web :5173 concurrently
npm run dev:server                   # server only (tsx watch)
npm run dev:web                      # web only (vite)
npm run build                        # tsc + vite build, both workspaces
npm run typecheck                    # tsc, both workspaces, no emit
npm run lint                         # eslint, both workspaces
npm test                             # both test suites
npm run check                        # typecheck + lint + test, in that order
```

`lint`/`typecheck`/`test` are each defined per-workspace too
(`npm run lint --workspace=web`, etc.), which is what the root scripts call.
Each workspace has its own `eslint.config.js` (flat config) — different
globals/plugins per environment, not one shared config. `web`'s turns off
two rules from `eslint-plugin-react-hooks`'s newer React-Compiler-derived
rule set (`set-state-in-effect`, `purity`) that conflict with patterns used
deliberately throughout the app (fetch-on-mount via `useEffect`+`setState`,
mainly) — see the comment block in `web/eslint.config.js` before assuming
either rule should just be re-enabled.

### Running a single test

Vitest, from inside `server/` or `web/`:

```bash
npx vitest run test/api.test.ts              # one file
npx vitest run -t "rejects a duplicate link"  # by test name, any file
npx vitest                                    # watch mode (or `npm run test:watch`)
```

### Database

```bash
npm run prisma:generate   # regenerate the Prisma client after a schema change
npm run prisma:migrate    # create a new migration + apply it (dev)
npm run prisma:studio     # browse the DB
```

`prisma/schema.prisma` hardcodes its SQLite `url` (`file:./mabigfam.db`)
rather than reading `env("DATABASE_URL")` — Prisma 7 dropped support for the
`url = "..."` form entirely, which is why this repo is pinned to Prisma 6.x
(see README). Because the URL is hardcoded, the Prisma CLI ignores a
`DATABASE_URL` override; `server/test/globalSetup.ts` works around this by
copying the schema to a temp dir with the URL rewritten before migrating a
throwaway test database — don't try to point tests at a different DB via
env var alone, it won't take effect.

## Architecture

### Server: auth gate + route registration (`server/src/app.ts`)

`buildApp()` builds the full Fastify instance without listening (tests drive
it via `app.inject()`); `src/index.ts` just calls it and listens. Route
modules are plain `register`ed plugins in `src/routes/`, one per resource.

A global `onRequest` hook (`authGate` in `src/auth.ts`) denies by default,
but **only for paths under `/api/`**. Three carve-outs inside that scope:
`/api/health`, `/api/auth/login`, `/api/auth/session` are public; anything
under `/api/calendar/` skips the gate because that route checks its own
token instead (see below). Everything else under `/api/` needs a valid
session cookie.

Paths *outside* `/api/` are never gated — that's what lets the built
frontend (`registerFrontend()`, active once `web/dist` exists) serve its
login page's own HTML/JS/CSS to an anonymous visitor. This is a single
process serving both API and static frontend in production, with no reverse
proxy needed (see README's Deployment section); in dev, Vite's own server
serves the frontend instead and proxies `/api` to this server (see
`web/vite.config.ts`).

`app.ts` also overrides Fastify's default JSON body parser to treat an empty
body as no body rather than a 400 — Fastify's stock parser rejects a
bodyless request (e.g. a plain `DELETE`) that declares
`Content-Type: application/json`, which browsers do routinely. Don't revert
this to the Fastify default; it previously broke every delete action in the
UI.

### Calendar feed: a second auth mechanism

Google/Apple Calendar fetch a subscribed `.ics` feed server-to-server with
no cookies, so `GET /api/calendar/:token/mabigfam.ics` can't sit behind the
session gate. It carries its own secret (`config.calendarFeedToken`,
derived from `SESSION_SECRET` unless `CALENDAR_FEED_TOKEN` is set) verified
timing-safely in the route itself, checked via 404 (not 401) so a wrong
token doesn't confirm a real one exists. The URL that *reveals* the token to
a signed-in user (`GET /api/calendar/subscription`) is normal session-gated.

### Data model relationships

`ParentChild` is directed (parentId → childId); link creation in
`routes/parentChild.ts` does a BFS to reject anything that would create a
cycle. `Partnership` is symmetric but stored as one row, not two mirrored
ones — `aId` is always the lexicographically smaller id (enforced in
`routes/partnerships.ts`'s `canonicalPair()`), which is what lets the
`@@unique([aId, bId])` constraint catch a duplicate added in either order.

### Frontend tree rendering pipeline

This is the most cross-file flow in the app. `GET /api/tree` returns the
raw `{ members, links, partnerships }`. From there, in order:

1. `web/src/lib/buildRelativesTree.ts` converts that into the `Node[]` graph
   shape the `relatives-tree` layout library expects — deriving siblings
   (full vs. half, by shared-parent overlap) and, where a `Partnership` isn't
   recorded but two people share a child, *inferring* them as partners so
   older data still renders as a couple.
2. `web/src/lib/connectedComponent.ts` restricts that graph to just the
   BFS-reachable family of the currently-selected root, before it ever
   reaches the layout library. This is deliberate, not an optimization:
   `relatives-tree`'s layout code assumes one connected family and
   historically threw on multi-branch input, and without this restriction
   selecting an unrelated or unconnected person produced a confusing
   "N people aren't shown" warning about everyone else in the database.
3. `web/src/pages/TreeView.tsx` calls `relatives-tree`'s `calcTree()` itself
   in a `try/catch` *before* handing the same nodes to `<ReactFamilyTree>`
   (which would otherwise call it internally and throw during render,
   blanking the page) — a caught failure renders an explanation with the
   raw error and stack instead.
4. `web/src/lib/partnerConnectors.ts` derives one badge per rendered
   partnership from the post-layout node positions, since `relatives-tree`
   draws every connector line (ancestry or partnership) as the same plain
   segment.

### `relatives-tree` is patched (`patches/`, via `patch-package`)

`node_modules/relatives-tree/lib/children/arrange.js` has a real upstream
bug — reachable even for an ordinary two-parent family, reliably in Firefox
and never observed in Chromium — where a failed internal lookup is read
without a null check. The library is at its latest release with no fix
available, so this is patched directly and reapplied automatically via the
root `postinstall` script. If `npm install` reports the patch failing to
apply, the upstream file has changed shape; regenerate it per the note at
the top of the patch file / in the README.

### Cookie security is a tri-state, not just `NODE_ENV`

`config.secureCookies` (`server/src/config.ts`) drives the session cookie's
`Secure` flag: defaults to `NODE_ENV === "production"`, but is overridable
either way via `COOKIE_SECURE=true`/`false`. This exists because a `Secure`
cookie sent over plain HTTP is silently *not stored* by the browser at all —
login appears to succeed but the session never sticks — which only shows up
once the app is reached by a real hostname/LAN IP rather than `localhost`
(browsers treat `localhost` as an exception). A plain-HTTP production
deployment (e.g. LAN-only, see `docs/deploy-proxmox.md`) must set
`COOKIE_SECURE=false` explicitly.

### Module resolution in `server/`

`tsconfig.json` uses `NodeNext`/`NodeNext` — relative imports need an
explicit `.js` extension even though the files are `.ts` (e.g. `import {
config } from "./config.js"` inside `config.ts`'s own directory). This is
required by the module system, not a typo, throughout `server/src`.

## Test infrastructure notes

- **Server integration tests** (`server/test/api.test.ts` and friends) drive
  the real Fastify instance via `app.inject()` against the throwaway DB from
  `globalSetup.ts`. `fileParallelism: false` in `server/vitest.config.ts` is
  required — they share one SQLite file.
- `server/src/config.ts` computes its exported `config` object once, at
  import time, from `process.env`. Tests that need a *different* config
  value than the suite-wide defaults (`server/test/frontend.test.ts`,
  `server/test/cookieSecurity.test.ts`) use `vi.stubEnv()` +
  `vi.resetModules()` + a dynamic `import("../src/app.js")` to force a fresh
  module graph — a plain env var change after the fact won't affect an
  already-imported `config`.
- **Web component tests** (`web/test/TreeView.test.tsx`) don't use
  `@testing-library/react` — in this npm-workspaces layout it hoists to the
  root, where `react` isn't resolvable from, so it can't load. They use the
  small `web/test/renderHelper.tsx` (built directly on `react-dom/client` +
  `act`) instead. Pure-logic test files run in vitest's `node` environment;
  files needing the DOM opt in per-file with a `// @vitest-environment
  jsdom` pragma comment at the top.
- `web/test/singleReact.test.ts` guards against a real recurring bug:
  `react-family-tree` and `react-router` declare loose `react` peer ranges,
  so a second, newer React can get hoisted alongside the pinned one, and
  when that happens the Tree view throws during render and blanks the page.
  Guarded by `overrides` in the root `package.json` (forces npm to resolve a
  single copy on disk — this is what actually protects the dev server and
  production build) plus `resolve.dedupe` in `web/vitest.config.ts` (needed
  separately because Vitest's module resolution doesn't go through Vite's
  own dependency pre-bundling the same way the dev server does). If a
  dependency change ever makes the Tree view blank, run `npm test` and check
  `npm ls react --all` before debugging application code.

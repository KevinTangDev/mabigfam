# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

mabigfam is a family-tree app for sharing member info, a genealogy tree, a
shared calendar, and a photo-guessing game with an extended family. npm
workspaces monorepo: `server/` (Fastify API + SQLite via Prisma) and `web/`
(React + Vite, Tailwind 4 with a warm custom palette), sharing
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

`npm install`/`npm ci` does **not** generate the Prisma client against this
repo's schema — verified against a genuinely fresh clone, `@prisma/client`
installs as an empty package skeleton (no `FamilyMember` type, no query
engine binary) until `prisma generate` runs explicitly. Typecheck/build
will fail with missing-type errors that look unrelated to Prisma if this
step is skipped after a fresh install — see `.github/workflows/ci.yml` for
where it has to happen (before typecheck, right after install).

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

### Soft delete: `ACTIVE_MEMBER` and the Trash lifecycle

`FamilyMember.deletedAt` (nullable) is the only thing a normal delete
touches — `ParentChild`/`Partnership` rows and the photo file are left
alone, which is what lets Restore bring a member back with every
relationship intact. `ACTIVE_MEMBER` (`{ deletedAt: null }`, exported from
`server/src/db.ts`) is spread into the `where` of essentially every route
that resolves members or their relations — list, get-by-id, tree, exports,
the calendar feed's birthdays, and the `include` filters inside
`/api/members/:id/relations` (a trashed parent/child/partner just doesn't
appear in the array, rather than the route needing to know about trash at
all). New routes/queries touching `FamilyMember` need to spread this in
too, or a trashed member leaks back into view.

Three endpoints past the normal CRUD: `GET /api/members/trash` (list),
`POST /api/members/:id/restore` (only works on an *already-trashed* id —
404 otherwise), and `DELETE /api/members/:id/purge` — the real, irreversible
delete, gated to only work on an already-trashed id (you can't purge an
active member directly; Delete-then-Purge is the deliberate two-step). Purge
is the one place that does a real Prisma delete (so the schema's
`onDelete: Cascade` actually fires) and the one place that deletes the photo
file.

### Photo pipeline: resize-and-normalize on upload

`server/src/storage.ts`'s `savePhoto()` validates by magic bytes (not the
browser-supplied Content-Type), then unconditionally pipes the buffer
through `sharp`: `.rotate()` (auto-orients from EXIF and bakes it into the
pixels — required, not cosmetic, since sharp doesn't carry EXIF through the
re-encode, so skipping this ships sideways portrait phone photos), resize to
fit within `config.photoMaxDimension`, re-encode as JPEG at
`config.photoQuality`. Every stored photo is JPEG regardless of upload
format — `readPhoto()`'s mime sniff and the vCard exporter's `TYPE` param
both rely on that.

HEIC is still rejected (see README) — confirmed via
`sharp.format.heif.input.fileSuffix` (`[".avif"]` only) that `sharp`'s
prebuilt binary scopes HEIF input to AVIF, not real HEVC-coded iPhone HEIC
photos; adding `sharp` for resizing doesn't change this.

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

### Login rate limiting, and why the test suite doesn't trip it

`POST /api/auth/login` opts into `@fastify/rate-limit` per-route (`config: {
rateLimit: config.loginRateLimit }` in `routes/auth.ts`) — the plugin itself
is registered with `global: false` in `app.ts`, so nothing else is limited.
`config.loginRateLimit` (`LOGIN_RATE_LIMIT_MAX`/`LOGIN_RATE_LIMIT_WINDOW`,
defaulting to 5/minute) is overridable because `server/test/helpers.ts`'s
`login()` is called from nearly every test file's `beforeEach` against one
shared app instance — hundreds of logins from the same `inject()` address
well within a minute. `globalSetup.ts` raises `LOGIN_RATE_LIMIT_MAX` far
above what the real suite ever does so that ambient usage never trips it;
`server/test/loginRateLimit.test.ts` builds its own app with a small value
instead (same fresh-module-registry isolation as `cookieSecurity.test.ts`).

### Backup (`routes/backup.ts`)

`GET /api/backup` streams a zip of the database plus every photo file — a
self-service alternative to the SSH/Proxmox-snapshot backup in
`docs/deploy-proxmox.md`. It runs `VACUUM INTO` (via
`prisma.$executeRaw`) to get one consistent snapshot file rather than
copying the live `.db` file directly, which could otherwise race a
concurrent writer and capture a torn file. `archiver` 8.x changed its API
from a callable factory to named classes (`import { ZipArchive } from
"archiver"`, not `import archiver from "archiver"` — the latter fails to
compile, `@types/archiver`@8 matches the new shape); `reply.send(archive)`
starts streaming before `archive.finalize()` is awaited, which is the
pattern that lets the handler still append entries and clean up the temp
snapshot file afterward. Deliberately not filtered by `ACTIVE_MEMBER`: this
is a disaster-recovery snapshot, so it includes trashed members too.

### Frontend design system (`web/`)

- **Tokens** live in `web/src/index.css`. The `ctp-*` names are Catppuccin's *slot* names
  (base = page, mantle = cards, crust = wells, surface0-2 = borders, overlay/subtext = muted
  text) but the values are a custom palette (Linen light / Cocoa dark). `brand` is the
  primary action colour — use `bg-brand text-on-brand`, not `ctp-blue`, for primary actions.
  Hue tokens (blue, green, red ...) stay literal. Shadows are `shadow-card` / `shadow-pop`.
- **Shared pieces**: `components/ui.tsx` (Button, `cardClass`, `inputClass`, `PageHeader`,
  `Chip`, `EmptyState`, `Skeleton`), `components/icons.tsx` (inline SVG set — add a path
  there rather than using emoji or a dependency), `Avatar`, `CountdownChip`.
- **`selectClass`, not `inputClass w-auto`**: `inputClass` contains `w-full`, and Tailwind
  can't reliably let a later `w-auto` beat it, so selects that should size to content use
  `selectClass` (the same string without `w-full`).
- **Touch**: hover-revealed actions also need `pointer-coarse:opacity-100` or they are
  invisible on phones (Tailwind 4 only applies `hover:` where hover exists). Primary nav is a
  bottom bar below `sm` (five items; Game is desktop-nav + dashboard shortcut only).
- **Routes**: `/` is the dashboard, `/contacts` the member list (was `/`). The dashboard
  shortcuts deep-link with `?new=1`, which Contacts and Calendar read to open their Add dialog.
- **Tree canvas**: `components/PanZoomCanvas.tsx` owns scrolling/zoom (CSS transform on a
  wrapper sized to the scaled content). Generation bands and partner badges are siblings of
  `.tree-canvas`, never children — `react-family-tree` owns that div and the tests count its
  direct `div`/`i` children as cards/connectors.
- **Pure helpers with tests**: `lib/generations.ts` (partners share a generation),
  `lib/birthdays.ts` (countdowns), `lib/relationships.ts` (parents/siblings/partners per member).
- There is deliberately **no email field** on members, so contact quick actions are call,
  message (`sms:`), directions and vCard only; adding email is a schema + API + export change.

### Internationalisation (`web/src/i18n/`)

EN / FR / 中文, in-house (no i18n library). `en.ts` is the source of truth and defines
`MessageKey`; `fr.ts`/`zh.ts` are `Record<MessageKey, string>` so a missing key fails
typecheck. `createI18n(lang)` in `config.ts` is a pure factory (`t`, `date`, `number`,
`errorText`) — `useI18n()` in `index.tsx` is just a context around it, and with no provider
it defaults to English, which is why most component tests need no wrapper.

- **Never hardcode UI text.** `t("key")` for text, titles, aria-labels, placeholders,
  `confirm()` and `setError()` messages. `web/test/i18nAudit.test.ts` parses the source
  with the TypeScript AST and fails on literals, so it will tell you.
- **Plurals**: write `foo_one` and `foo_other` and call `t("foo", { count })`. French treats 0
  and 1 as singular; Chinese repeats the same text in both. Both variants must exist in every
  dictionary (the key set must match exactly).
- **Dates/numbers** go through `date(value, opts)` / `number()` — not
  `toLocaleDateString(undefined, …)`. Stored all-day dates are UTC midnight, so pass
  `timeZone: "UTC"`.
- **Lib helpers** (`countdownLabel`, `relationshipLabels`, `addedLabel`, `greeting`) take `t`
  (or `date`) as an argument instead of importing the hook.
- **Server messages** are English; add any new user-visible one to `serverErrors.ts` and the
  dictionaries. Validation details pass through untranslated.
- **French typography** (no-break space before `? ! : ;`) is applied once in `fr.ts`, so write
  plain spaces there. `<em>…</em>` is the only markup, rendered by `rich()`.
- Header width is the tight spot: French labels are the longest, so the top nav only appears
  from `lg`, the brand text hides between `lg` and `xl`, and Sign out is icon-only below
  `2xl`. Re-check `/` at 1024px in French after adding nav items.
- Fonts: Fraunces and Plus Jakarta Sans have no Han glyphs; the stacks fall back to system
  sans CJK fonts, and `:lang(zh) em` is un-italicised (CJK has no true italic).

### Docker deployment (`Dockerfile`, `compose.yaml`, `docs/deploy-docker.md`)

- Stages: `build` (full install + build; also what the one-shot `migrate` service runs,
  because it has the Prisma CLI), `prod` (build pruned of devDependencies), `runtime`.
  Don't prune inside `build` — migrate would lose the CLI.
- **Migrations go through `deploy/docker-migrate.sh`**, never a bare `prisma migrate deploy`:
  the schema hardcodes its SQLite URL and the CLI ignores `DATABASE_URL`, so a bare run would
  migrate a database inside the image instead of the `/data` volume. The script migrates a
  copy of the schema with the URL rewritten (same trick as `server/test/globalSetup.ts`).
- `migrate` and `app` both run as the `node` user; if migrate ran as root it would create the
  DB file root-owned and the app couldn't write to it.
- `TRUST_PROXY` (`config.trustProxy` → `Fastify({ trustProxy })`) must be on behind a tunnel or
  proxy, else every visitor shares the login rate limit's one bucket (a typo locks the family
  out; a stranger can do it deliberately). It must be off if the port is reachable directly,
  or `X-Forwarded-For` can be forged. Compose publishes no port so the tunnel is the only way in.
- Compose passes unset optional variables as `""`, so optional config must treat empty as unset
  (`||`, not `??`) — see `CALENDAR_FEED_TOKEN` in `config.ts`.
- `npm install`/`ci` doesn't run `prisma generate`; the Dockerfile, `deploy/update.sh` and both
  deploy docs do it explicitly.

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
- **Web component tests** (one file per page under `web/test/`: `Dashboard`, `ContactsView`,
  `MemberDetail`, `BirthdaysView`, `TreeView`, `TrashView`, `CalendarView`, `GameView`,
  `LoginScreen`) don't use
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

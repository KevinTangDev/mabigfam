# mabigfam

[![CI](https://github.com/KevinTangDev/mabigfam/actions/workflows/ci.yml/badge.svg)](https://github.com/KevinTangDev/mabigfam/actions/workflows/ci.yml)

A small family-tree app: a Fastify + TypeScript + Prisma API backed by
SQLite, and a React + TypeScript frontend with a sortable/filterable table
view and a genealogy tree view (built on
[`relatives-tree`](https://www.npmjs.com/package/relatives-tree) /
[`react-family-tree`](https://www.npmjs.com/package/react-family-tree), which
handle the multi-parent layout case a plain recursive tree struggles with).

## Structure

- [`prisma/schema.prisma`](prisma/schema.prisma) — `FamilyMember`,
  `ParentChild`, `Partnership` and `FamilyEvent` models, SQLite datasource.
- [`server/`](server) — Fastify API. Shared-passphrase auth, CRUD for
  members, photo upload/serving, parent/child link management (with cycle
  prevention), and routes that resolve a member's (or the whole tree's)
  relations for the UI.
- [`web/`](web) — Vite + React frontend, styled with Tailwind CSS 4 and the
  [Catppuccin](https://catppuccin.com) palette (Latte / Mocha). Login gate,
  table view, member detail view (edit fields, photo, manage parent/child
  links), and tree view.

## Theming

Light is Catppuccin **Latte**, dark is **Mocha**, toggled from the header and
remembered in `localStorage` (first visit follows the OS preference). An
inline script in [`web/index.html`](web/index.html) applies the flavor before
first paint so dark-mode users don't get a white flash.

Components only use semantic `ctp-*` utilities (`bg-ctp-base`,
`text-ctp-subtext0`, `border-ctp-surface1`, ...). Those are declared with
Tailwind's `@theme inline` in [`web/src/index.css`](web/src/index.css) so each
utility emits a `var()` reference and follows whichever flavor is active —
which is why there are almost no `dark:` variants in the markup. To restyle,
change the variables in that one file.

## Roadmap

Against the original brief, these are still to come:

- [x] Member fields, parents/children, table + tree views
- [x] Photos (upload, serving, avatars throughout)
- [x] Auth (shared family passphrase)
- [x] CSV export
- [x] Contacts export for Android/iOS (vCard `.vcf`)
- [x] Calendar for reunions and important dates, with a subscribable `.ics`
      feed plus per-event export / "Add to Google Calendar"
- [x] Trombinoscope guessing game (identify a family member from their photo)

Everything from the original brief is now built.

## Trash

Deleting a member from the table or their profile is a **soft delete** —
they move to Trash (linked from the table toolbar), not gone. Restore
brings them back with every relationship intact (parent/child links,
partnerships, photo), since none of that is actually touched by a delete;
only permanently deleting *from Trash* is the real, irreversible removal,
and that's a separate confirmation. A trashed member simply disappears from
every list, the tree, exports and the calendar feed — `ACTIVE_MEMBER` in
[`server/src/db.ts`](server/src/db.ts) is the one shared filter every route
applies, rather than each hand-rolling `deletedAt: null` and risking one
being missed.

## Exports

From the table view's **Export** menu:

- **CSV** for spreadsheets, with parent/child names resolved. Carries a UTF-8
  BOM so Excel on Windows doesn't mangle Chinese names.
- **vCard (`.vcf`)** for phone contacts — one file with every card, which is
  what iOS and Android expect for a bulk import. Photos are embedded, with a
  no-photos variant when size matters. A single person can also be saved from
  their own profile page.

## Calendar

The **Calendar** tab holds family reunions and important dates, and surfaces
the next few birthdays (derived from member profiles — birthdays are not
stored twice).

Three ways to get dates into a calendar app:

1. **Subscribe** to the feed URL shown on the page — the good option. New
   events and birthdays then appear automatically. Google Calendar:
   *Other calendars → From URL*. iPhone: *Settings → Calendar → Accounts →
   Add Subscribed Calendar*.
2. **Add to Google Calendar** per event.
3. **Download `.ics`** per event, for Apple Calendar or Outlook.

> [!IMPORTANT]
> The feed URL contains a secret token and is **not** behind the login.
> It can't be: Google and Apple fetch subscribed feeds server-to-server and
> send no cookies, so the URL itself has to carry the credential (this is the
> same "private iCal address" pattern Google uses). Treat it like a password —
> anyone holding it can read the family's events. Rotate it by setting
> `CALENDAR_FEED_TOKEN` in `server/.env`, which invalidates existing
> subscriptions without signing anyone out.

## Requirements

- Node.js 20+

## Setup

```bash
npm install
npm run prisma:migrate
```

This creates `prisma/mabigfam.db` and applies the schema. Re-run
`npm run prisma:migrate` whenever `prisma/schema.prisma` changes.

Then create the server's secrets:

```bash
cp server/.env.example server/.env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put that random string in `SESSION_SECRET` and pick a `FAMILY_PASSWORD` for
your family to use. **The server refuses to start if either is missing** —
deliberately, so it can never boot in a state where anyone who reaches the
URL can read everyone's addresses, phone numbers and photos.

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

## Deployment

`npm run build` produces `server/dist` and `web/dist`. Once `web/dist`
exists, the server serves it itself — one Node process, one port, no
separate static file server or reverse proxy required. That's deliberate:
it's what makes a single small VM or container a complete deployment.

```bash
npm install                 # applies patches/, generates the Prisma client
npx prisma migrate deploy --schema=prisma/schema.prisma
npm run build
cp server/.env.example server/.env   # then edit it — see below
node server/dist/index.js
```

Required in `server/.env` beyond the local-dev setup:

- `NODE_ENV=production`
- **`COOKIE_SECURE`** — if this won't sit behind HTTPS (e.g. a home-LAN-only
  server), set `COOKIE_SECURE=false` explicitly. Without it, `NODE_ENV=production`
  makes the session cookie `Secure`-only, which browsers enforce strictly: a
  `Secure` cookie sent over plain HTTP is silently **not stored at all**.
  Login appears to succeed (the server responds 200) but every request after
  that looks signed-out, because the browser just never kept the cookie.
  `http://localhost` is exempted by browsers from this (treated as a secure
  context), which is exactly why this can pass local testing and then fail
  once reached by a LAN IP or real hostname — test against the actual address
  the family will use, not `localhost`, before trusting it works.

A step-by-step guide for a Proxmox LXC container specifically is in
[`docs/deploy-proxmox.md`](docs/deploy-proxmox.md), including a systemd
service file and an update/backup workflow.

## Lint & typecheck

```bash
npm run typecheck   # tsc, both workspaces
npm run lint        # eslint, both workspaces
npm run check       # typecheck + lint + test, in that order
```

ESLint 10 flat config, one `eslint.config.js` per workspace (different
globals/plugins: `web`'s needs React + browser globals, `server`'s doesn't).
`web`'s config turns off two rules from `eslint-plugin-react-hooks`'s
React-Compiler-derived "recommended" set —  `set-state-in-effect` and
`purity` — because they flag patterns used deliberately throughout this app
(fetching on mount via `useEffect` + `setState`, `Date.now()` inside a
`useMemo` that only needs to be stable across re-renders, not across time);
see the comment in `web/eslint.config.js` for the reasoning. Everything else
in both configs' `recommended` sets is on, including the rules that already
did their job during setup — `web`'s `exhaustive-deps` caught a real stale
closure in `MemberDetail.tsx`, fixed by wrapping its refetch helper in
`useCallback`.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm run
typecheck`, `lint`, `test` and `build` on every push to `master` and every
PR — the same commands as `npm run check` above, as separate steps so a
failure names the exact stage. No external services needed: the test suite
provisions its own throwaway SQLite database (see `globalSetup.ts` under
Tests below).

One step is easy to assume is unnecessary and isn't: a bare `npm ci` does
**not** generate the Prisma client against this repo's schema — verified
locally against a genuinely fresh clone, `@prisma/client` installs as an
empty package skeleton (no `FamilyMember` type, no query engine binary)
until `npx prisma generate` runs explicitly, which is its own CI step
before typecheck.

## Tests

```bash
npm test
```

Runs both suites (Vitest). `npm run test:watch` inside `server/` or `web/`
watches.

- **`server/test`** — unit tests for the CSV, vCard and iCalendar writers
  (escaping, line folding, all-day DTEND semantics), plus integration tests
  that drive the real routes through `app.inject()`, covering the auth gate,
  cycle prevention, partnership rules, and cascade behaviour.
- **`web/test`** — unit tests for the relatives-tree graph builder (siblings,
  half-siblings, explicit vs inferred partners) and the calendar date helpers
  (end-exclusive ranges, birthday rollover, leap days); jsdom render tests
  that mount the real Tree view over stubbed API data; and a guard that fails
  if a second copy of React ever gets installed (see below).

### The duplicate-React trap

`react-family-tree` and `react-router` declare open-ended peers
(`react >=16`), so npm is free to satisfy them with a *newer hoisted copy*
than `web`'s pinned 18.3.1. When that happens `react-family-tree` builds
elements with one React while the app renders with another, React throws
`A React Element from an older version of React was rendered`, and the whole
app unmounts — the Tree view becomes a blank page with no visible clue.

Three things guard against it now: `overrides` in the root `package.json`
pinning both packages, `resolve.dedupe` in the Vite/Vitest config, and
`web/test/singleReact.test.ts`, which fails if more than one copy is on disk.
If the Tree view is ever blank again, run `npm test` first — and check
`npm ls react --all`.

The integration tests copy `schema.prisma` to a temp directory with the
datasource URL rewritten and migrate a throwaway database, so they can never
touch the real family data. That indirection is needed because the schema
hardcodes its URL rather than reading `env("DATABASE_URL")`, which means the
Prisma CLI would otherwise ignore an override and migrate the real file.

## Security notes

- All `/api` routes are denied by default; only `/api/health`,
  `/api/auth/login`, `/api/auth/session` and the token-authenticated calendar
  feed are reachable without a session. Photos and exports are gated —
  they're PII like everything else. The gate only covers `/api` — in
  production the server also serves the built frontend (see Deployment
  above), and that has to stay reachable without a session or the login
  page's own HTML/JS/CSS couldn't load. Nothing sensitive lives in the
  static bundle; every route that returns family data is under `/api`.
- The session cookie is HMAC-signed (`SESSION_SECRET`), `httpOnly`,
  `sameSite=lax`, and `secure` by default once `NODE_ENV=production` —
  overridable with `COOKIE_SECURE`, see Deployment above for why a
  plain-HTTP LAN deployment needs `COOKIE_SECURE=false` explicitly.
- Uploads are validated by **magic bytes**, not the browser-supplied
  `Content-Type`, so a text file renamed `.jpg` is rejected. Stored filenames
  are server-generated UUIDs, never derived from user input.
- Before putting this on the public internet: serve it over HTTPS, set
  `NODE_ENV=production`, and note that auth is a single shared passphrase —
  there are no per-member accounts, so everyone who signs in can edit and
  delete anything.

## Notes / known limitations

- Photos are written to `server/uploads/` on local disk. That's fine locally
  and on a host with a persistent volume, but a container platform with an
  ephemeral filesystem will lose them on restart — swap the three functions
  in [`server/src/storage.ts`](server/src/storage.ts) for S3/R2 and nothing
  else needs to change.
- Every accepted photo is resized to fit within `PHOTO_MAX_DIMENSION`
  (default 2000px on the longest side — generous headroom; nothing in this
  app displays a photo anywhere near that large) and re-encoded as JPEG at
  `PHOTO_QUALITY` (default 82) before being stored, via
  [`sharp`](https://sharp.pixelplumbing.com). Every stored photo is JPEG
  regardless of the upload's original format.
- HEIC (the default iPhone photo format) still isn't accepted — decoding it
  needs the HEVC codec, which `sharp`'s prebuilt binary deliberately excludes
  for licensing reasons (its HEIF support is scoped to AVIF only; confirmed
  via `sharp.format.heif.input.fileSuffix`, not assumed). Adding `sharp` for
  resizing doesn't change this. Uploading straight from iOS normally
  transcodes to JPEG automatically; a `.heic` file from a desktop gets a
  message explaining how to convert it.
- `FamilyMember` has no `gender` field, which relatives-tree uses only for
  its own styling — irrelevant here since the node cards are custom.
- **The tree draws only the selected person's own connected family** — the
  people reachable from the root through parent, child and partner links
  (computed in [`connectedComponent.ts`](web/src/lib/connectedComponent.ts)).
  Selecting someone in a different, unrelated family shows just their side;
  selecting someone with no relationships at all shows them alone, with no
  warning. This also keeps relatives-tree from ever having to lay out more
  than one connected family at once, which its own layout code is not built
  for. If the layout still can't place everyone *within* the selected
  family, a banner lists who — the usual cause is a relationship recorded on
  only one side, e.g. a child with just one parent linked whose parent has a
  partner, since the library models children as belonging to a couple.
  Linking the second parent usually fixes it.
- **`relatives-tree` is patched** (via [patch-package](https://www.npmjs.com/package/patch-package),
  see [`patches/`](patches/)). Its `arrangeNextFamily` function assumed a
  lookup always succeeds and read/wrote a `.pos` property on the result
  without checking — reachable even for an ordinary two-parent family with
  shared children, reliably in Firefox and never observed in Chromium (this
  class of bug — an array/property access whose success depends on
  iteration order that the spec leaves engines free to differ on — is a
  known source of Chrome/Firefox divergence for otherwise "pure" code, though
  the exact mechanism here wasn't pinned down). The library is at its latest
  version (3.2.2) with no newer release and no matching upstream issue, so
  this patches the one function to skip the positional adjustment instead of
  throwing when the lookup fails, rather than not rendering at all. The
  patch reapplies automatically via `postinstall` — if `npm install` ever
  reports it failing to apply, the upstream file has changed shape and the
  patch needs regenerating (edit `node_modules/relatives-tree/lib/children/arrange.js`
  the same way, then run `npx patch-package relatives-tree`).
- Partnerships are explicit (`Partnership`, with married/partner/divorced),
  but two people who share a child and have no recorded partnership are
  still *inferred* as a couple so older data keeps rendering sensibly.
  Siblings remain derived from shared parents, with half-siblings
  distinguished from full ones — see
  [`web/src/lib/buildRelativesTree.ts`](web/src/lib/buildRelativesTree.ts).
- Prisma is pinned to the 6.x line: Prisma 7 removed the classic
  `datasource { url = "..." }` form used in `schema.prisma` in favor of a
  `prisma.config.ts` + driver-adapter setup, which would mean rewriting the
  schema this project shipped with.
- `npm audit` reports 3 accepted-risk findings that only a breaking major
  upgrade would clear, all low-impact for this app: a stack-exhaustion DoS
  in `deepmerge-ts`, pulled in by the Prisma **CLI's** own config loader
  (not a runtime dependency — fixed only by Prisma 8, see above); two
  moderate `react-router` advisories fixed only in React Router v7 (a
  breaking API migration) — one is an SSR hydration issue that doesn't apply
  here (this app is a client-only SPA), the other an open-redirect in
  `<Link>`/`useNavigate` that requires navigating to attacker-controlled
  paths, which this app never does; and a path-traversal advisory in
  `@vitest/mocker` (fixed only in Vitest 5) — `vitest` is a devDependency
  only, never bundled or shipped, and the vulnerable path is a browser-mode
  dev-server feature this project doesn't use. Don't run `npm audit fix
  --force` reflexively: in this npm-workspaces layout it has previously
  misattributed
  hoisted deps into the wrong workspace's `package.json` (e.g. adding
  `fastify` to `web` and `vite`/`react-router-dom` to `server`).

# mabigfam

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
  (end-exclusive ranges, birthday rollover, leap days).

The integration tests copy `schema.prisma` to a temp directory with the
datasource URL rewritten and migrate a throwaway database, so they can never
touch the real family data. That indirection is needed because the schema
hardcodes its URL rather than reading `env("DATABASE_URL")`, which means the
Prisma CLI would otherwise ignore an override and migrate the real file.

## Security notes

- All `/api` routes are denied by default; only `/api/health`,
  `/api/auth/login`, `/api/auth/session` and the token-authenticated calendar
  feed are reachable without a session. Photos and exports are gated —
  they're PII like everything else.
- The session cookie is HMAC-signed (`SESSION_SECRET`), `httpOnly`,
  `sameSite=lax`, and `secure` once `NODE_ENV=production`.
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
- HEIC (the default iPhone photo format) isn't accepted, since decoding it
  needs a native image library. Uploading from iOS normally transcodes to
  JPEG automatically; a `.heic` file from a desktop gets a message explaining
  how to convert it.
- `FamilyMember` has no `gender` field, which relatives-tree uses only for
  its own styling — irrelevant here since the node cards are custom.
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

# Architecture

**Status:** adopted 2026-10-06 from the OnePortal hub's architecture (suite kit v7 since 2026-10-07; decision log
§12). This is the contract the code follows. A deviation needs an explicit decision, recorded in
the decision log.
**Related:** [PROGRESS.md](./PROGRESS.md) — where things stand and what each session found.
[AUDIT.md](./AUDIT.md) — security. The suite contract lives in the hub:
`D:\Khushiyal\next-oneportal\docs\CHILD-APP-GUIDE.md` (referred to below as *the hub guide*).

---

## 0. Principles

These override any general convention.

1. **No duplication.** If the same logic — a validation, a query, a calculation, a
   formatting rule — appears twice, extract it. Before writing a function, check whether
   it already exists.
2. **No speculative layers.** No service, repository or interface "for consistency" or
   "for later". A simple feature is one file. A layer appears only when there is real
   logic to put in it.
3. **One pattern per concern, used everywhere.** How input is validated, how errors are
   returned, how access is checked, how settings are read — identical across features,
   never case-by-case. When a second pattern is needed, replace the first everywhere or
   record why not.
4. **Legibility over cleverness.** A reader should understand a file without opening five
   others. Comments explain *why*. Prefer explicit and slightly repetitive over clever —
   unless the repetition is real duplication (rule 1).
5. **Secure by default.** Nobody reads or changes data they do not own, however the
   request is shaped. A new field is private until it is deliberately exposed (§6).
   Anything with consequences — who may open which application, who is an administrator,
   whether a code or link is still valid — is decided on the server only, at the moment of use.
6. **A rule that matters has a check.** Whatever this document says must hold — access
   scoping, one-time codes, lockout — is pinned by an automated check (§10), so a
   regression fails a check instead of reaching users.

Project-specific:

7. **DigiDocs never sees a password.** People sign in only through OnePortal; DigiDocs receives
   an identity (`id`, `email`, `full_name`) from the hub's token endpoint and starts its own session.
8. **The database clock is the clock.** Every expiry and comparison of instants is computed in
   SQL (`SYSDATETIMEOFFSET()`), so web servers' clocks and time zones cannot matter.
9. **Every screen, 320 px to 2560 px+.** Mobile-first Tailwind classes; the page never scrolls
   sideways; tables collapse to their main column on phones (`showFrom` in
   `src/components/ui/table.tsx`) and repeat hidden facts under it; inputs are 16 px on phones (no
   iOS zoom); controls are 40 px tall on phones and 36 px from `sm`, never under 24 px; nothing is
   reachable only by hover; pinch-zoom stays enabled. The kit (`src/components/ui`,
   `src/components/forms`) implements these; `npm run test:ui` pins them. Suite applications
   follow the same rules (CHILD-APP-GUIDE.md §8).

---

## 1. Boundary: how a request is handled

| Kind of entry point | Use for | Where | How it is called |
|---|---|---|---|
| **Server action** | Everything a signed-in person does from a DigiDocs page | `src/features/<feature>/actions.ts` (`"use server"`) | From an `<ActionForm action={…}>` (`features/users`, `features/organisations`) |
| **Page** (server component) | Reading data for a screen | `src/app/**/page.tsx` | Browser navigation |
| **Route handler** | The sign-in round trip through OnePortal, started by a browser redirect; "Back to OnePortal" | `src/app/sso/login/route.ts`, `src/app/sso/callback/route.ts`, `src/app/sso/leave/route.ts` | `GET` redirect / plain link |
| **Script** | Operator tasks on a test installation, run by a person | `scripts/seed-test-users.ts`, `scripts/clear-data.ts`, `scripts/grant-admin.ts` | `npm run test-users:seed`, `npm run data:clear`, `npm run admin:grant` |
| **Proxy** | Remembering where a signed-out person was going (convenience, not security) | `src/proxy.ts` | Every request outside `/sso/`, `/api/`, `/_next/`, static files |

The rule that decides the kind: **who starts the request.** DigiDocs's own pages → server action.
A cross-site browser redirect (the hub) → route handler.

Every entry point has the same shape, and nothing else:

> **authenticate → authorize (role) → validate input → scope to the caller's records →
> call the logic → shape the output → return one result type.**

The only entry points without a person-guard are the ones that *create* a caller:
`GET /sso/login` and `GET /sso/callback` (the one-time code, redeemed with the app secret, is the
credential), and `GET /sso/leave` (it only ends the caller's own session, then opens the hub).
The scripts run with the operator's own database access.

Anything reachable from outside the process is public API, whatever its file is called. Every
exported function in a `"use server"` file is callable by anyone with the page open, with any
arguments — treat it that way.

### Accepted trade-offs

- **Every page is rendered per request** (`dynamic = "force-dynamic"` in the kit's root layout).
- **A launch from a hub tile carries no `state`** (hub guide §10). Strict mode is not used.

---

## 2. Where things live

```
database/
  migrations/        numbered .sql files — the schema's source of truth, run by a person
  setup/             one-time DBA script: database + least-privilege app login
  maintenance/       idempotent housekeeping (purge expired sessions)
  seed/              test-users.json: the test users (hub CHILD-APP-GUIDE §5.8)
docs/                these documents
scripts/             operator commands: test-users seed, data clear
logs/                PM2's log files (only logs/.gitignore is tracked)
ecosystem.config.cjs PM2 configuration — suite kit
src/
  instrumentation.ts validates settings at server start
  proxy.ts           signed-out → /sso/login?returnTo=…
  app/               routes only: pages, layouts, route handlers
    (app)/           signed-in shell (layout.tsx + app-header.tsx: DigiDocs's own header) and its pages:
                     home (/ = dashboard), reports/ ("coming" pages, section.tsx), imports/ and exports/ (lists:
                     submission-list.tsx; Add pages "coming"), page-title.tsx (page header + breadcrumb), master/
                     (banks, agents, ports), /no-access, admin/ (users, organisations, reference)
    sso/             login, callback, leave (route handlers); error (page)
  features/          one folder per concern, holding the rules
    auth/            OnePortal client, user linking (+ test users), sessions, guards
    access/          the roles and the menu per role (pure)
    masters/         banks, clearing agents, ports (the Master screens)
    dashboard/       the dashboard cards and the workflow statuses of each step (pure)
    workflow/        the workflow statuses, who sees which, the lists' shared filters and scope (pure)
    imports/         imports: reads (list, dashboard counts); later the form, its mapping tables, the writer
    exports/         exports: the same, separately
    users/           role, organisation and status of people (administration)
    organisations/   the enterprises
    reference/       reads of the fixed reference lists (no writer: migrations only)
    audit/           the audit log writer
    maintenance/     the data:clear parts
    appearance/      the active theme (from the cookie the callback sets)
  themes/            one file per theme + the list of themes — suite kit
  components/        shared UI: ui/ (primitives), forms/ (ActionForm), shell/ (top bar) — suite kit
  lib/               cross-cutting plumbing: config, db, result, schemas, tokens, urls, test-users, data-clear — suite kit
tests/
  unit/              pure rules, no database (npm test): themes, charts, SQL names, test users
  ui/                screen-size rules in a real browser (npm run test:ui)
```

**Suite kit files** carry a `// Suite kit v7: …` header. *Copied* ones are changed in the hub
first, then copied here; *adapted* ones (config, session, guards, user menu, `/sso` layout,
404 page, Playwright config, the UI and SQL-naming checks) merge hub changes by hand.

### A feature folder

Files appear only when needed: `schemas.ts` (the only place an input shape is defined), `queries.ts`
(reads, scoped to the caller, returning DTOs built field by field), `actions.ts` (thin entry
points), `writes.ts` or a named writer file (the one place a table is written), pure logic files
(no database, no clock, no session; never decide access).

Who writes what:

| Table | Only writer |
|---|---|
| `user_accounts` — hub id, email, name | `features/auth/link-user.ts` (created/refreshed at every sign-in; test users by `saveTestUser`) |
| `user_accounts` — role, organisation, mobile number, active | `features/users/writes.ts` |
| `organisations` | `features/organisations/writes.ts` (seeded by migration 0003) |
| `audit_events` | `features/audit/record.ts` |
| `banks`, `clearing_agents`, `ports` | `features/masters/writes.ts` (the Master screens; rows from 0004 plus those LFZ Admins add) |
| `imports` | **No writer yet**: Add Import brings `features/imports/writes.ts`; migration 0007 made the table |
| `exports` | **No writer yet**: Add Export brings `features/exports/writes.ts`; migration 0007 made the table |
| Other reference lists: `hse_codes`, `countries`, `currencies`, `nigerian_states`, `free_zones`, `measurement_units`, `document_types`, `transaction_types`, `transaction_type_documents` | **No writer in the app**: migrations 0004–0006 |
| `user_sessions` | `features/auth/session.ts` |

### The database schema

The source of truth is `database/migrations/NNNN_name.sql`, applied in order by a person with a
DDL-capable account (`sqlcmd -S <server> -d DigiDocsOPNext -E -b -i <file>`). Each file runs in one
transaction, records itself in `dbo.schema_migrations`, does nothing if already applied, and is
**never edited once applied anywhere**. From 0006 on a migration is pure ASCII (other characters as
`NCHAR(code)`; a unit check enforces it), and `sqlcmd` is always run with `-f 65001`: without it the
Windows code page garbled 0004–0005 (repaired by 0006). The web app's login (`digidocs_app`) has `db_datareader`
+ `db_datawriter` only. No ORM; row types are declared next to the query that reads them.

### Data conventions

The hub's (hub `docs/ARCHITECTURE.md` §2): ids are `UNIQUEIDENTIFIER` (`NEWSEQUENTIALID()`),
lower-cased in TypeScript, validated with `idSchema`; instants are `DATETIMEOFFSET` computed in
SQL; shown to people via `<LocalTime>`; secrets stored as SHA-256 hex; names are lower-case
`snake_case`, plural tables, `_id`/`_at`/`is_`, and **never a word SQL Server reserves or SSMS
highlights, nor the singular of a plural table name** — pinned by `tests/unit/sql-names.test.ts`.
Foreign keys to `user_accounts` are `account_id`. The hub's permanent person id is `hub_user_id`.

---

## 3. No speculative layering

A trivial feature is one entry point: guard → parse → scoped write → `Result`. A feature with
real rules gets its own module, and the entry point orchestrates **load → decide → write**.

## 4. Validation: one definition

One zod schema per input, in the feature's `schemas.ts`; shared building blocks (`idSchema`,
`emailSchema`, `checkboxSchema`, `idListSchema`, `formToObject`) live in `src/lib/schemas.ts`.
The schema runs **on the server**, in the entry point, right after authenticating — including
ids, hidden fields, `params` and `searchParams`. Forms show the returned `fieldErrors`. The acting
user always comes from the session, never from input.

## 5. Errors: one shape

`Result<T>` in `src/lib/result.ts` (`ok`, `done`, `fail`, `notFound`, `invalidInput`). Expected
failures are returned; unexpected failures throw and reach `src/app/error.tsx`, which shows a
reference number, never details. TypeScript is `camelCase`, SQL `snake_case`; queries map rows to DTOs.

---

## 6. Authentication and authorization

### Sign-in through OnePortal

The contract is the hub guide §4–§6. In DigiDocs:

1. A signed-out request reaches `src/proxy.ts` (no session cookie) → `/sso/login?returnTo=<path>`.
   `requireUser()` sends anyone without a valid session to `/sso/login` too.
2. `GET /sso/login` stores `{state, returnTo}` in the `digidocs_sso_state` cookie (`HttpOnly`,
   `SameSite=Lax`, `Path=/sso`, 10 minutes) and redirects to `{ONEPORTAL_URL}/sso/authorize`.
3. The hub decides whether this person may open DigiDocs and redirects to `/sso/callback?code=…&state=…`
   (no `state` when launched from the hub's tile).
4. `GET /sso/callback` checks `state` against the cookie, redeems the code **server to server**
   (`POST {ONEPORTAL_URL}/api/sso/token` with App ID and secret, 10-second timeout, never retried,
   never logged), links the person by **hub id** (`findOrCreateUser`), starts a session, sets the
   theme cookie and redirects to `returnTo` (`safeNextPath`: same-site paths only).
5. Every failure lands on `/sso/error?reason=…`, which never redirects by itself (no loops).
6. **There is no sign-out in DigiDocs** (hub guide §10). "Back to OnePortal" (header and user
   menu) is a plain `<a href="/sso/leave">`: `GET /sso/leave` ends this browser's DigiDocs session
   server side and opens the hub, where "Sign out" is. Never a `<Link>`: a prefetch would end the session.

### Sessions

Rows in `dbo.user_sessions`. The browser holds a random 256-bit token in an `HttpOnly`,
`SameSite=Lax` cookie (`__Host-digidocs_session`, `Secure`, when `APP_URL` is HTTPS;
`digidocs_session` in plain-HTTP development); the table holds its SHA-256. Lifetime
`SESSION_TTL_HOURS` (default 8), absolute. Every request re-reads the session and the user
(`getCurrentSession`, cached per request): not revoked, not expired, user active. "Back to
OnePortal" (`/sso/leave`) revokes the session server side. Signing out of the hub does not
sign people out of DigiDocs (hub guide §10).

### Guards and authorization

Guards (`src/features/auth/guards.ts`) are the first line of every page and action:

- `requireUser()` — signed in, whatever the role. Only the shell and `/no-access` use it.
- `requireMember()` — signed in **and** given a role; otherwise `/no-access` ("waiting for access").
- `requireRole(...roles)` — one of these roles; anyone else gets **404** (not advertised).
- `requireMenuItem(href)` — the roles the **menu** gives that page (`src/features/access/menu.ts`).
  Every page in the menu uses it, so the top bar, a section's tabs and the page's guard come from one list.

**Roles** are a fixed list in code (`src/features/access/roles.ts`: LFZ Admin, Enterprise User,
NEPZA User, NIS User, Account), stored as `user_accounts.role_key` with a CHECK that a unit test
compares with the code. One role per person. Roles live in DigiDocs, never in the hub.

**How a person gets access:** OnePortal decides who may *open* DigiDocs. At their first sign-in
DigiDocs creates their account with **no role** (least rights). An LFZ Admin then gives them a role
on the Users page — and, for an **Enterprise User**, the organisation they work for. The first LFZ
Admin is made from the command line (`npm run admin:grant`). People are never linked by email.

**Organisations** are the free-zone enterprises. Only an Enterprise User has one (a CHECK enforces
it); LFZ, NEPZA, NIS and Account staff work across all of them. Deactivating an organisation takes
its people's role away at their next request (the session query treats it as no role) without
ending their session or deleting anything.

**Scoping** (from the Import module on): an Enterprise User's reads and writes are filtered by
`organisation_id = @caller's organisation`; out of scope reads as not found. The import and export
lists do it in `features/workflow/list.ts` `listScope` (the organisation comes from the session, never
from the address bar); every role also sees only the statuses `VISIBLE_STATUSES` gives it.

An LFZ Admin cannot change their own role or deactivate themselves, so DigiDocs cannot lose its
last administrator by accident; `npm run admin:grant` restores one if it happens anyway.

### Theme

The hub sends the person's theme key with every sign-in; the callback stores it in the
`digidocs_theme` cookie and `src/features/appearance/active-theme.ts` reads it for the root layout.
The key is matched against the kit's theme list (`findTheme`); anything unknown is `classic`.
It only chooses colours.

### What leaves the server

A database row is never returned as-is; DTOs are built field by field. `token_hash` is never
selected for a DTO.

---

## 7. Writes, transactions and concurrency

`withTransaction(async (tx) => …)` in `src/lib/db.ts`. Writers that may join a transaction take
`db: Db` first. Writes that must know what they changed use `OUTPUT`; zero rows means "not yours"
or "someone else got there first" — an expected outcome. One-time things are consumed with one
conditional `UPDATE … OUTPUT`. A first sign-in racing another creates the row once (unique
`hub_user_id`, retried as an update).

## 8. Optional modules

### 8c. Background jobs

None in the web process. `database/maintenance/purge_expired.sql` deletes expired sessions;
idempotent, scheduled by the operator.

### 8d. Test installations (kit v6)

- **Test users** (hub guide §5.8): `database/seed/test-users.json` lists them with fixed hub ids
  and `@oneportal.test` addresses; `npm run test-users:seed` creates or refreshes them in one
  transaction through `saveTestUser`, which only ever touches rows whose address is a test
  address. The hub creates the same people from the same file. A new role or relationship gets a
  test user in the same change. Run by a person on a test installation, never by the app.
- **Clearing** (hub guide §5.9): `npm run data:clear` empties chosen parts
  (`src/features/maintenance/clear-parts.ts`: `test-users`, `people`, `sessions`). It refuses
  unless `ALLOW_DATA_CLEAR=true`, counts without `--confirm`, and deletes only when `--confirm`
  names the database the connection is really in. A new table gets a part in the same change.

### 8e. Configuration and secrets

- Settings only through `getConfig()` (`src/lib/config.ts`); `src/instrumentation.ts` validates at
  server start: a missing or malformed setting stops the server with a list.
- Production requires an `https://` `APP_URL`.
- `PORT` is read by Next.js itself, before it loads `.env.local`; npm scripts pass it in with
  dotenv-cli, F5 with `envFile`. `config.ts` refuses a `localhost` `APP_URL` on another port.
- `ONEPORTAL_APP_SECRET` is server-side only: never `NEXT_PUBLIC_…`, never logged, never committed.

### 8f. Personal data

Stored: work email and full name copied from the hub, and a mobile number entered by an LFZ
Admin (`user_accounts`); actor email and IP per audit event (`audit_events`); IP address (only if
`CLIENT_IP_HEADER` is set) and user agent per session (`user_sessions`). Sent to third parties:
nothing (the hub is called with the code and the app's credentials only).

---

## 9. Legacy and retired code

There is none: built to this document from its first line (2026-10-06).

The previous DigiDocs (ASP.NET MVC, `D:\Khushiyal\Digidocs`, database dump
`Database/digidocs-09Mar26.sql`) is **not** part of this repository: it is read as a reference for
what each module does, module by module, and never changed. Its tables, stored procedures and
screens are re-designed here to this document; only reference data is copied (as migrations).

---

## 10. Checks

| Check | Covers | Needs |
|---|---|---|
| `npm run typecheck` | Route types (`next typegen`) + TypeScript | — |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) | — |
| `npm test` | `tests/unit`: every theme complete and readable (WCAG contrast, chart colours); the charts' arithmetic; schema names (no keyword or SSMS-highlighted word); the test-users file parses with DigiDocs's schema; clear parts have unique keys | — |
| `npm run build` | Production build | — (no runtime settings needed) |
| `npm run test:ui` | `tests/ui`: every page at 320–2560 px — no sideways scroll, inputs ≥ 16 px on phones, controls ≥ 36 px on phones and ≥ 24 px elsewhere | `npm run build` first; Microsoft Edge installed. Signed-in pages also need `UI_BASE_URL` (DigiDocs running with a database), a running OnePortal, and `E2E_EMAIL`/`E2E_PASSWORD` of a hub user with access to DigiDocs |

Add a check with every feature that has rules or is security-relevant. **Fix the code, not the
check** — unless the rule genuinely changed, in which case change both and say so in PROGRESS.md.

---

## 11. Operational requirements

| # | Requirement | If it is wrong |
|---|---|---|
| 1 | Migrations are applied, in order, before a new build starts | Queries fail on missing tables or columns |
| 2 | The app connects as `digidocs_app` (data read/write only) | A compromised app could change the schema |
| 3 | `APP_URL` is the public `https://` address; DigiDocs has its own host name (subdomain recommended), not a port or path on another suite application's host (hub guide §5.7) | Cookies are not `Secure`; other applications on the host receive DigiDocs's cookies |
| 4 | The callback URL registered in OnePortal is `APP_URL` + `/sso/callback` | Every sign-in fails at the hub |
| 5 | The server reaches `ONEPORTAL_URL/api/sso/token` and trusts its certificate (`NODE_EXTRA_CA_CERTS` for an internal CA) | Every sign-in fails at the code exchange |
| 6 | `CLIENT_IP_HEADER` is set **only** behind a reverse proxy you control | Anyone could write any IP into session records |
| 7 | `purge_expired.sql` runs daily (or at least weekly) | The sessions table grows; nothing breaks |
| 8 | Several instances need no sticky sessions | All state is in the database |
| 9 | On a server it runs under PM2 from `ecosystem.config.cjs` (`npm run pm2:start`, `pm2:reload` after a deploy; `pm2 save` + `pm2 startup`), behind the reverse proxy that does HTTPS | It does not come back after a crash or reboot |
| 10 | `ALLOW_DATA_CLEAR` is never set, and the test-users seed never run, where real people sign in | Test accounts or data loss on a live installation |
| 11 | The first LFZ Admin is made with `npm run admin:grant` after they opened DigiDocs once | Nobody can assign roles |

---

## 12. Decision log

Append when a decision is made or reversed. **Never rewrite history — add an entry.**

| Date | Decision | Rationale |
|---|---|---|
| 2026-10-06 | **Adopt the suite architecture and kit v3** (hub `docs/ARCHITECTURE.md`, CHILD-APP-GUIDE §3): Next.js 16.3.7, TypeScript 5, Tailwind 4, zod 4, `mssql` tagged templates, numbered SQL migrations run by a person, the suite UI kit copied from the hub | DigiDocs is a OnePortal suite application; one stack and one set of conventions across the suite. |
| 2026-10-06 | **Sign-in only through OnePortal** — no login page, no passwords; own users linked by hub id (`hub_user_id`), own database sessions (8 hours) | Hub guide §2–§6. The hub owns identity and access to applications; DigiDocs owns what people may do inside it. |
| 2026-10-06 | **Theme follows the hub (cookie set at sign-in)** — `digidocs_theme`, matched against the kit's theme list; no theme table | Hub guide §7.3 (contract 1.1). Works on signed-out pages, needs no migration, and only chooses colours. |
| 2026-10-07 | **Kit v3 → v7** (hub CHILD-APP-GUIDE §3.5): the suite's new look (v4), same tab and no sign-out (v5), test users and the data-clear command (v6), PM2 (v7) | Keep DigiDocs identical to the rest of the suite; the hub moved to v7 on 2026-10-05. |
| 2026-10-07 | **No sign-out here: Back to OnePortal ends this application's session** (`/sso/leave`); the sign-out action and `/sso/signed-out` page are removed | Hub guide §10 (kit v5): people sign in and out in OnePortal only; a signed-out page in the sign-in frame read as a second login. |
| 2026-10-07 | **Runs under PM2 from the kit's `ecosystem.config.cjs`** (process `digidocs`, port from `.env.local`) | Hub guide §3.6 (kit v7): every suite application is operated the same way on a server. |
| 2026-10-07 | **Database is the existing `DigiDocsOPnext`**, not a new `DigiDocs` database; `create_database.sql` is kept only for a fresh installation | Owner's choice. The database already has tables: before `0001_initial.sql` runs there, check it for `dbo.user_accounts`, `dbo.user_sessions` and `dbo.schema_migrations` (PROGRESS.md #10). |
| 2026-10-07 | **Database is a new, empty `DigiDocsDBNext`**, created by `database/setup/create_database.sql`. Reverses the 2026-10-07 entry "Database is the existing `DigiDocsOPnext`" | Owner's choice when the rebuild of the old DigiDocs started; `DigiDocsOPnext` already had `schema_migrations`, `user_accounts` and `user_sessions` of unknown origin. |
| 2026-10-07 | **Rebuild the old DigiDocs (ASP.NET MVC) module by module in this codebase, with a clean schema** (suite conventions: GUIDs, snake_case, SQL in code, no stored procedures); only reference data is copied, as migrations | Owner's choice. The old tables (`M_Role`, `T_ImpExp`, PascalCase, 85 stored procedures) break ARCHITECTURE §0 and the naming check; transactional data starts fresh. |
| 2026-10-07 | **Roles are a fixed list in code, one per person; only an Enterprise User has an organisation; LFZC is not an organisation** | Old DigiDocs decided menus by role id in code (`roleid == 1/2/3/5`), so a role table adds nothing. Its `OrganizationTypeId` was "NEPZA" for every row, and LFZ/NEPZA/Account staff all belonged to the zone operator: in practice only enterprises are organisations. Owner chose one role per person. |
| 2026-10-07 | **Access is assigned by an LFZ Admin after the person's first sign-in** (no pre-registration by email, no self-registration; first admin from the command line) | Owner's choice. Links people by hub id only (hub guide §6 rule 4); enterprises no longer register themselves — admins add organisations. |
| 2026-10-07 | **Uploaded files will be stored in a folder on the server** (`FILE_STORAGE_PATH`, outside the web root; the database keeps name, size and hash; served only through a guarded route) — built with the first module that needs uploads | Owner's choice. Module 1 needs no uploads: the old licence/permit paths were never set; the signature image is used on approval letters (Import module). |
| 2026-10-07 | **Audit log of administrators' changes** (`audit_events`, same shape as the hub's) | Role and organisation changes decide what people may see; the old app had `ActivityLog`. |
| 2026-10-07 | **Correction: the database is `DigiDocsOPNext`** (reverses the row "Database is a new, empty `DigiDocsDBNext`"; `create_database.sql` now names `DigiDocsOPNext`) | Owner: `DigiDocsDBNext` was a mistake and does not exist. `DigiDocsOPNext` already holds `schema_migrations`, `user_accounts`, `user_sessions` (PROGRESS.md #10): checked before 0002 runs. |
| 2026-10-08 | **Reference lists are fixed data, changed only by new migrations**; LFZ Admins get a read-only Reference data page (counts, HSE code search) | Owner's choice. Faster to build; an edit screen can be added later for any list that needs one (a decision-log entry then). |
| 2026-10-08 | **What was copied from the old reference tables, and how** (0004–0005): one currency per ISO code (the old table had one per country, 224 → 153) without the garbled symbols; ports with sea/air and units with solid/liquid as CHECKed columns instead of list-of-values ids; only the active required-document links; HSE codes with their four rates and 2022 tariff period. Not copied: suppliers (test data), the empty loading-port table, country regions, incident categories, gender/department; workflow statuses, form-field configuration (M_KeyInfoInput), fees, months/years come with the Import, Export and Orion modules | Owner chose reference data only and no suppliers; the rest follows what the old app actually used. `type_name` became `transaction_name`: the naming check refused TYPE_NAME (an SSMS built-in). |
| 2026-10-08 | **The menu follows old DigiDocs per role, as sections with tabs** (Home · Reports · Import · Export · Master · Administration for an LFZ Admin; the old dropdowns become each section's tabs), defined once in `features/access/menu.ts`, which also decides each page's roles (`requireMenuItem`). The old "Dashboard ▾" menu (reports) is called Reports; the old Home (step counts) is the dashboard on Home | Owner's choice. The kit has no dropdown menu and a new shared component goes to the hub first; tabs are kit components and work on phones. Below `xl` the sections move to their own row, which scrolls inside itself on a small phone (six sections do not fit beside the brand). |
| 2026-10-08 | **Screens of later modules are in the menu now, each with a "coming" page** saying which module brings it and what the old screen did | Owner's choice: the whole old menu visible from the start. |
| 2026-10-08 | **The dashboard is built before its data**: five workflow-step tiles + total + status summary, filtered by transaction type and enterprise; real counts are 0 until the Import module, and "Show sample data" fills it with marked, repeatable sample figures (hub guide §7.4) | Owner's choice. The steps follow old `GetDashBoardCount`; the query that counts them comes with the imports table (module 4). An Enterprise User's figures are their own organisation's. |
| 2026-10-08 | **LFZ logo as DigiDocs content** (`public/lfz-logo.png`, copied from old DigiDocs) on the welcome panel and the sign-in error page; the top bar keeps the kit's mark. Colours: the suite's Lagos Free Zone theme, chosen in OnePortal | Owner's choice. Changing the header mark would change the kit (hub first); the Lagos theme already matches the logo's navy and red-orange. |
| 2026-10-08 | **DigiDocs has its own header, like the LFZ design** (D:\Khushiyal\DigidocsNext): a stripe in the logo's colours, a white row with the LFZ logo, "DigiDocs" and the person, a menu row with **dropdowns**, and an LFZ copyright footer (`src/app/(app)/app-header.tsx`, `layout.tsx`). **A deliberate exception** to the suite shell (hub CHILD-APP-GUIDE §7.1) and to "new components go into the hub's kit first"; reverses the row "The menu follows old DigiDocs per role, as sections with tabs". Kept from the suite: theme tokens only (the stripe is `mark` · `muted` · `header`), "Back to OnePortal" (header, user menu, phone menu) as a plain `<a>`, "OnePortal account", no sign-out, 320 px–2560 px | Owner's choice: DigiDocs should look like the LFZ design users know. The kit's `user-menu.tsx` and `nav-links.tsx` stay as copied (kit files) though DigiDocs's header no longer uses them. |
| 2026-10-08 | **Dashboard as in the LFZ design**: LFZ Admin home = "Dashboard / Import status summary", Particular (import types) and Enterprise filters that apply on change, five cards (Total Count, Pending from LFZ, Pending from NEPZA, Approval pending from LFTZ, Process Completed) opening the import list at their step; other roles: their menu as shortcut cards. Reverses "The dashboard is built before its data" in part: the welcome panel, status summary and "Show sample data" are removed (no graphs left, so §7.4 rule 6 does not apply) | Owner's choice, following DigidocsNext (live GetDashBoardCount). Card colours are theme tokens (primary, warning, chart-1, accent, success), not the design's fixed amber/violet. |
| 2026-10-08 | **Masters (module 3) built now**: Banks (add beside the list, edit page), Clearing agents (list, Add Agent page returning to the list, edit), Ports (add, list with type filter, edit); duplicates refused in the writing statement; "delete" is deactivate | Owner's choice; rules as DigidocsNext keeps old DigiDocs's (agent email ≤ 50, phone 7–15 digits). Port types are sea/air only (0004 has no border ports). |
| 2026-10-08 | **Import and export lists before their forms** (migration 0007): tables `imports` and `exports` with only what the lists and workflow need (enterprise, creator, transaction type, tracking number, status and reason, created / form saved / submitted times); Add Import and Add Export add their form columns in their own migrations. A tracking number is unique within its table. Rows have no actions yet: View, Edit and Delete come with the forms. Nothing copied from T_ImpExp / Map_ExportKeyInfo (transactions, not reference data) | Owner's choice. The lists can be built and checked now; the form fields are designed with the forms. |
| 2026-10-08 | **Workflow statuses are a fixed list in code** (`features/workflow/statuses.ts`, CHECKed `status_key`), with the old labels; old ids 10 and 11 (both "Process Completed") are one status, `completed` | Owner's choice; as roles (§0.2). |
| 2026-10-08 | **Who sees which statuses: old ImpExp_G, two changes.** "Enterprise Submit" (old id 12, the enterprise's cover-letter step) is seen only by the enterprise (the old procedure showed it to LFTZ, NEPZA and Account because 12 > 4); an LFZ Admin also sees "Saved by NEPZA" (old id 7, hidden by ImpExp_G), because the dashboard counts it under "Pending from NEPZA" and the card opens the list. Enterprise rows are scoped to the organisation, not the creator | Owner's choice (both). Pinned by `tests/unit/submissions.test.ts` against the old WHERE. |
| 2026-10-08 | **Imports and exports are kept apart** at every level: own tables (`imports`, `exports`), own mapping tables when the forms come, own feature folders (`features/imports`, `features/exports`). The database enforces the transaction type's direction: each table has a fixed `transaction_direction` in its foreign key to `transaction_types (id, direction)`, so an import cannot carry an export type. Only the workflow rules and the list screen are shared | Owner: "import related transaction will come to import table and their mapping tables, and same for export". Changed in 0007 before it was applied. |
| 2026-10-08 | **The dashboard counts imports now** (`countImportsByStatus`, the statuses an LFZ Admin sees, filtered by Particular and Enterprise; `cardCounts` sums each card's statuses), and its filter form has a visible Filter button besides applying on change | Owner: the filter seemed not to work: it applied, but every card was a fixed 0. |
| 2026-10-08 | **The header stripe is always the LFZ logo's colours** (#f51f00 red-orange, #707070 grey, #001f57 navy) in every theme, as fixed values in `app-header.tsx`: the one exception to "colours only as theme tokens". It had used the `mark`/`muted`/`header` tokens, which are black/grey/white in Classic | Owner's choice: the stripe belongs to the logo, which does not change with the theme either. |
| 2026-10-08 | **Every signed-in page has DigiDocs's own compact page header** (`src/app/(app)/page-title.tsx`): a breadcrumb from the menu (`menuTrail`: Home › section › item › record; sections are dropdowns, so not links), a small title (1.125-1.25 rem) beside a bar in the brand mark colour, a line of description, the page's actions, a thin rule. Replaces the kit's large `PageHeader` and the "← back" links; the Home dashboard no longer says "Dashboard" as its title | Owner's choice. Part of the LFZ header exception, so the kit's `PageHeader` stays as it is (kit files change in the hub first). |

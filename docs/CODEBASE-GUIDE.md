# DigiDocs Codebase Guide

The front door for someone new to this project. It tells you where things are, what to open to
change something, and how to run it.

| File | What it is | Open it when |
|---|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | The rules this code follows, and a dated decision log | You wonder "why is it done this way?" |
| [PROGRESS.md](./PROGRESS.md) | What was built when, open items | You wonder "was this deliberate?" or "what is left?" |
| [AUDIT.md](./AUDIT.md) | The security review: checked, fixed, accepted | You are about to touch sign-in, sessions or anyone's data |
| Hub `docs/CHILD-APP-GUIDE.md` (`D:\Khushiyal\next-oneportal`) | The suite contract: sign-in, kit, look, screen sizes, test users, PM2 | You touch `src/app/sso`, `src/features/auth` or a kit file |

---

## 1. The project in one paragraph

DigiDocs is an application in the OnePortal suite (organisation: EdgeAxis), on suite kit v7.
People open it from the OnePortal launcher, in the same tab, and arrive already signed in:
DigiDocs never sees a password and has no "Sign out" — "Back to OnePortal" ends its session and
returns to the hub. It keeps its own users (linked to the hub by the hub's permanent id) and its
own sessions in a SQL Server database (`DigiDocsOPNext`). It is a rebuild of the old DigiDocs
(ASP.NET MVC, `D:\Khushiyal\Digidocs`: the customs import/export workflow of the Lagos Free Zone),
module by module (PROGRESS.md §1a). Built so far: module 1 — roles, users and organisations.

## 2. The tree

```
.vscode/                       launch.json (F5), tasks.json — suite kit
ecosystem.config.cjs           PM2 configuration — suite kit (process = package name "digidocs")
logs/                          PM2 log files (only logs/.gitignore is tracked)
database/
  setup/create_database.sql    a new database + login (only for a fresh installation)
  migrations/0001_initial.sql  user_accounts, user_sessions
  migrations/0002_access.sql   organisations, role/organisation/mobile on user_accounts, audit_events
  migrations/0003_enterprises.sql  the 35 enterprises from the old DigiDocs
  migrations/0004_reference_lists.sql  countries, currencies, states, free zones, units, ports, document and transaction types, banks, clearing agents
  migrations/0005_hse_codes.sql  the 6,836 HSE codes with their rates
  migrations/0006_fix_special_characters.sql  repairs 21 values 0004-0005 stored garbled
  migrations/0007_imports_exports.sql  imports, exports (separate; each held to its own transaction direction): the list columns and workflow status
  maintenance/purge_expired.sql
  seed/test-users.json         the seven test users: one per role, two enterprises, one waiting (hub guide §5.8)
  README.md                    how to run them
scripts/
  seed-test-users.ts           npm run test-users:seed
  clear-data.ts                npm run data:clear
  grant-admin.ts               npm run admin:grant (the first LFZ Admin)
src/
  proxy.ts                     no session cookie → /sso/login?returnTo=…
  instrumentation.ts           settings check at start-up — kit
  app/
    layout.tsx, globals.css, error.tsx, not-found.tsx   — kit
    (app)/layout.tsx           signed-in shell: brand, nav, "Back to OnePortal", user menu
    (app)/page.tsx             home (/): welcome panel with role and organisation
    (app)/no-access/page.tsx   "waiting for access" (signed in, no role yet)
    (app)/admin/               LFZ Admins only: users/, users/[id], organisations/, organisations/new, organisations/[id], reference/
    sso/layout.tsx, auth-card.tsx   signed-out frame (<AuthShell>) — kit (layout adapted: DigiDocs wording)
    sso/login/route.ts         start sign-in: state cookie → hub /sso/authorize
    sso/callback/route.ts      finish sign-in: check state, redeem code, link user, session, theme
    sso/leave/route.ts         "Back to OnePortal": end the DigiDocs session → hub
    sso/error/page.tsx         what went wrong (by ?reason=), "Back to OnePortal"
  features/
    auth/oneportal.ts          the only file that talks to the hub
    auth/link-user.ts          findOrCreateUser, saveTestUser (only writer of user_accounts)
    auth/schemas.ts            what DigiDocs knows about a test user (role, organisation short code)
    access/roles.ts            the five roles (fixed list)
    users/                     role, organisation, mobile, active (writer of those columns)
    organisations/             the enterprises
    audit/record.ts            the audit log (writer of audit_events)
    reference/                 reads of the fixed reference lists
    auth/session.ts            sessions (only writer of user_sessions) — kit (adapted)
    auth/guards.ts             requireUser() — kit (adapted)
    appearance/active-theme.ts theme from the digidocs_theme cookie
    maintenance/clear-parts.ts what data:clear can empty
  themes/                      classic, lagos, … — kit
  components/ui, forms, shell, local-time.tsx, copy-field.tsx — kit (ui/charts.tsx: the graphs)
  lib/                         config (adapted), db, result, schemas, urls, tokens, sql-text,
                               request-info, test-users, data-clear — kit
tests/
  unit/                        themes, charts, sql-names (+ keywords) — kit; test-users — DigiDocs
  ui/responsive.spec.ts        every page at 7 widths — kit (adapted)
```

## 3. To change X, open Y

| To change… | Open |
|---|---|
| A setting, or add one | `src/lib/config.ts` and `.env.example` |
| What the signed-in shell shows (nav items, links) | `src/app/(app)/layout.tsx` |
| The home page | `src/app/(app)/page.tsx` (`<Hero>`, `<SectionHeader>`; numbers as `<HeroStat>`/`<StatTile>` — hub guide §7.4) |
| Add a page | `src/app/(app)/<path>/page.tsx` (starts with `requireUser()` and `<PageHeader>`), then add it to `SIGNED_IN_PAGES` in `tests/ui/responsive.spec.ts` and a nav item in the layout |
| Add a graph or dashboard | Kit charts only (`src/components/ui/charts.tsx`), by the rules in hub guide §7.4, with a "Show sample data" switch |
| Who may open a page | the first line: `requireMember()` (any role) or `requireRole("lfz_admin", …)` — `src/features/auth/guards.ts` |
| The roles, their labels and descriptions | `src/features/access/roles.ts` (and the CHECK in a new migration if a key changes; a test compares them) |
| The header (stripe, logo row, menu row with dropdowns, phone menu) and footer | `src/app/(app)/app-header.tsx`, `src/app/(app)/layout.tsx` — DigiDocs's own, not suite kit (decision log 2026-10-08) |
| Banks, clearing agents, ports | `src/features/masters/`, pages under `src/app/(app)/master/` |
| The menu: sections, dropdown items, who may open each page, "coming" texts | `src/features/access/menu.ts` (the top bar, the tabs and `requireMenuItem` all read it); a new entry needs its `page.tsx` (a unit test checks) |
| The dashboard (cards and the statuses of each step) | `src/features/dashboard/steps.ts`, the count `countImportsByStatus` in `src/features/imports/queries.ts`, the page `src/app/(app)/page.tsx` |
| Import and export lists; who sees which workflow status | `src/features/imports/queries.ts`, `src/features/exports/queries.ts` (separate), `src/features/workflow/list.ts` (shared filters and scope), `src/features/workflow/statuses.ts`, the screen `src/app/(app)/submission-list.tsx` used by `imports/page.tsx` and `exports/page.tsx` |
| Replace a "coming" page with the real screen | the page under `src/app/(app)/<section>/…/page.tsx`; drop `comingIn` from its menu entry |
| A reference list (HSE codes, ports, currencies…) | a new migration — they are fixed data; the old values came from the dump with `legacy_id` |
| Add a feature | `src/features/<feature>/` — `schemas.ts`, `queries.ts`, `actions.ts`, a writer (ARCHITECTURE.md §2) |
| Add a table or column | a new `database/migrations/000N_….sql` (never edit an applied one); `npm test` checks the names; give the table a part in `src/features/maintenance/clear-parts.ts` |
| Add a role, supervisor or department | the column/table (migration), `src/features/auth/schemas.ts` (test-user schema), a test user for it in `database/seed/test-users.json`, its write in `saveTestUser` — in one change |
| Sign-in behaviour | `src/app/sso/*/route.ts`, `src/features/auth/oneportal.ts` — read the hub guide §4–§6 and AUDIT.md first |
| Session lifetime | `SESSION_TTL_HOURS` in `.env.local` |
| Wording of the signed-out frame / sign-in error | `src/app/sso/layout.tsx`, `src/app/sso/error/page.tsx` |
| Colours, fonts, sizes, buttons, cards | **Not here**: in the hub's kit, then copy (CHILD-APP-GUIDE §3.3, §7) |

## 4. The conventions

- Every page and action: `requireUser()` → zod parse (including ids, `params`, `searchParams`) →
  scoped query → DTO → `Result`.
- SQL only via `db.query\`…\`` / `withTransaction`; one writer per table.
- Forms are `<ActionForm>`; actions return `Result`.
- Colours only as theme tokens (`bg-surface`, `text-ink`, `bg-primary`…), never palette classes.
  Font sizes in rem (`text-[0.8125rem]`), never px.
- Mobile-first; every page works from 320 px to 2560 px+.
- Links to `/sso/leave` are plain `<a>`, never `<Link>`. Links to the hub or another suite
  application never use `target="_blank"`.

## 5. Running it

1. Apply the migrations to `DigiDocsOPNext` (`database/README.md`).
2. Register DigiDocs in OnePortal (Administration → Applications → Register application) with
   callback `http://localhost:3008/sso/callback`; give yourself access.
3. `.env.local` from `.env.example`: connection string, App ID and secret. `PORT=3008` and
   `APP_URL=http://localhost:3008` stay together.
4. Start OnePortal (port 3000), then DigiDocs: **F5** in VS Code ("Next.js: dev server", under the
   debugger) or `npm run dev`. Both read the port from `PORT` in `.env.local`.
5. Open DigiDocs from the OnePortal launcher, or go to `http://localhost:3008` (it sends you
   through the hub). "Back to OnePortal" returns you to the hub.
6. The first time you see "waiting for access": `npm run admin:grant -- --email <you>`, reload, then
   give everyone else their role in Administration → Users.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, then `npm run test:ui`.

### A test installation

```bash
npm run test-users:seed      # here: the seven digidocs.*@oneportal.test people, with their roles
# then in the OnePortal folder, with TEST_USER_PASSWORD set in its .env.local:
npm run test-users:seed -- --file D:/Khushiyal/next-digidocs/database/seed/test-users.json --app <App ID>
```

To start over: `ALLOW_DATA_CLEAR=true` in `.env.local`, then `npm run data:clear` (lists the parts:
`test-users`, `people`, `sessions`, `audit`), `-- --clear <parts>` (counts), `-- --clear <parts> --confirm
DigiDocsOPNext` (deletes). Never on an installation real people use.

### Deploying (PM2)

```bash
npm install -g pm2      # once per server
npm ci
npm run pm2:start       # build, then start (process "digidocs", port from .env.local)
npm run pm2:reload      # after each deploy: build, then reload without downtime
npm run pm2:logs        # also logs/digidocs.out.log and logs/digidocs.err.log
npm run pm2:status      # pm2:stop, pm2:delete
pm2 save && pm2 startup # survive a server restart
```

HTTPS and the host name stay at the reverse proxy (IIS, nginx), which forwards to
`localhost:<PORT>`. If it keeps restarting and then stops, the reason (usually a refused setting)
is in `logs/digidocs.err.log`.

## 6. Error playbook

| Symptom | Cause | Fix |
|---|---|---|
| Server stops with `Invalid settings` | A setting is missing or malformed (`ONEPORTAL_APP_ID` must be a GUID, the secret ≥ 32 characters) | Fix `.env.local`; the message lists each problem |
| `APP_URL: Uses port …, but PORT is …` | `PORT` and `APP_URL` disagree | Change them together, then the callback URL in OnePortal |
| `/sso/error?reason=rejected` | Code expired (breakpoint before the exchange, > 60 s), wrong App ID/secret (server log says `rejected this application's credentials`), or access removed | Open DigiDocs again from the launcher; check the two settings |
| `/sso/error?reason=state` | Sign-in took > 10 minutes, or was started in another tab | Start again |
| `/sso/error?reason=no-access` | The DigiDocs account is deactivated (`user_accounts.is_active = 0`) | A DBA re-activates it |
| Hub says the application is not available / not responding | No access in the hub, app inactive, wrong App ID — or DigiDocs is not running | Hub administrator grants access; start DigiDocs |
| Error page with a reference number on `/` | Database unreachable or migration not applied | Server log; `database/README.md` |
| Theme does not follow the hub | The theme is taken at sign-in | Open DigiDocs from the launcher again |
| `test-users:seed` says "its id belongs to a real person here" | A real account already has that hub id | Do not change the real row; check the file |
| "Waiting for access" after signing in | No role yet, or their organisation is deactivated | An LFZ Admin assigns a role (Administration → Users); the first one via `npm run admin:grant` |
| `admin:grant` says no single account has the email | They never opened DigiDocs, or two accounts share the email | Open DigiDocs once from OnePortal; for duplicates, fix the email in OnePortal |
| `typecheck` names a page that no longer exists | Stale route types in `.next/` | Delete `.next/` and run it again |

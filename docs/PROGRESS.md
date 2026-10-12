# Progress

Where DigiDocs stands, and what each session found. **Update this as part of the work, not
afterwards** — newest session entry first in §4.

**Rules for keeping it**
- Say what you did **not** verify, as plainly as what you did.
- Open items are numbered once and **never renumbered**. A finished item is struck through and
  marked done with its date, not deleted.
- A decision goes in the ARCHITECTURE.md decision log; here you refer to it.

**Suite kit version: v7** (contract 1.1; v3 → v7 on 2026-10-07), from `D:\Khushiyal\next-oneportal`.
**Database:** `DigiDocsOPNext` (corrected 2026-10-07: the name `DigiDocsDBNext` given earlier that day did not exist).
**Rebuilding:** the old DigiDocs (ASP.NET MVC, `D:\Khushiyal\Digidocs`, read-only reference), module by module (§1a).

---

## 1. Stages

| # | Stage | Status |
|---|---|---|
| 1 | **Basic setup** — Next.js project on the suite stack, kit v3 and themes, sign-in through OnePortal, own users and sessions, database scripts, signed-in shell with a home page, port 3008 and F5, architecture docs, checks | done 2026-10-06; typecheck, lint, unit checks, build, UI check (signed-out) and smoke test pass; **not yet run against a database or a hub** (#1–#4) |
| 1a | **Kit v7** — new look (v4), same tab and Back to OnePortal (v5), test users and data clear (v6), PM2 (v7) | done 2026-10-07; typecheck, lint, 50 unit checks, build, UI check (signed-out), smoke test and PM2 config check pass; **seed and data clear never run; PM2 never started** (#11, #12) |
| 2 | **First end-to-end sign-in** — from the OnePortal launcher into DigiDocs and back to OnePortal | not started (#1–#4, #10) |
| 3 | **DigiDocs features** — the old DigiDocs, module by module (table below) | in progress since 2026-10-07 |

### 1a. Modules (rebuild of the old DigiDocs)

The old application (`D:\Khushiyal\Digidocs`: WEB/API/BAL/DAL, 13 controllers, ~84 screens, 57
tables, 85 stored procedures) is the reference for each module. It is never changed.

| # | Module | Old screens / tables | Status |
|---|---|---|---|
| 1 | **Foundation: roles, users, organisations** | UserCreation, Role, M_Organization, UserDetails, Map_UserRole | built 2026-10-07; **not run against a database** (#14) |
| 2 | **Reference data** | M_HSECode, M_Country, M_Currency, M_PortDischarge, M_FreeZone, M_State, M_Unit, M_Document, M_Particular, Map_ParticularDocument, M_Bank, M_ClearingAgent | built and applied 2026-10-08 (migrations 0004–0006, read-only page); page not seen rendered yet |
| 2a | **Header, menus and dashboard** | _LayoutFinal.cshtml (menus per role), Home/DashBoardCount; design of D:\Khushiyal\DigidocsNext | built 2026-10-08: LFZ header with dropdowns, footer, dashboard cards and filters, shortcut cards for other roles, "coming" pages; header and dashboard layout seen on a preview at 375/1440 px, not signed in |
| 3 | **Masters** | ClearingAgent, Bank, Ports | built 2026-10-08 (Banks, Clearing agents, Ports; no migration needed); not used against the database yet (#23). Suppliers: with the Import module (they belong to an enterprise) |
| 4 | Import | ImpExp (72 actions): T_ImpExp, items, containers, invoices, documents; uploads (file storage, decision log 2026-10-07) | **List Import built 2026-10-08** (migration 0007 written, **not applied**, #25); Add/View/Edit/Delete not started |
| 5 | Export | Export (17 actions): T_Exp, key info, HSE codes, items, tracking, documents | **List Export built 2026-10-08** (same migration, #25); Add/View/Edit not started |
| 6 | Workflow | Saved by Enterprise → LFTZ → NEPZA → completed (M_WorkFlowStatus, T_ImpExpProcess, T_ExpProcess); signatures on approval letters | with 4–5 |
| 7 | Dashboards per role | Home: Dashboard, DashBoardCount, EnterpriseDashBoardCount, GetListImpExpBySteps | after 4–6 |
| 8 | Reports | SummaryReportList, SummaryOperationReport, RejectedHistory, FinalInvoiceList, Import/ExportFinalView | after 7 |
| 9 | Orion revenue (Account) | Orion: M_Revenue, M_GeneratedRevenue, Map_Organization_Orion_Masters | last |

Not carried over: the old login, registration, forgot/change password and session-expired pages
(OnePortal does sign-in); NIS users had no screens in the old menu.

---

## 2. Legacy register

Nothing: built to ARCHITECTURE.md from its first line (2026-10-06).

---

## 3. Open items

| # | Item | Owner / when |
|---|---|---|
| 1 | **Register DigiDocs in OnePortal**: Administration → Applications → Register application — name `DigiDocs`, callback `http://localhost:3008/sso/callback`, an icon; copy the App ID and secret; give yourself access. | Owner |
| 2 | ~~**Run the SQL** against `DigiDocsOPnext` (since 2026-10-07; no new database): the read-only check in `database/README.md` step 1 first (#10), then `database/migrations/0001_initial.sql`, and the app's data-only login if it has none. Nothing has run against SQL Server yet.~~ Superseded 2026-10-07 by #14 (new database `DigiDocsDBNext`). | Owner, after #10 |
| 3 | **Fill `.env.local`**: connection string (`Database=DigiDocsOPNext` since 2026-10-07, the login's password), `ONEPORTAL_APP_ID`, `ONEPORTAL_APP_SECRET`. On 2026-10-06 it held the placeholders from `.env.example`; on 2026-10-07 `npm run dev` started without a settings error (the file was not opened by Claude: it holds secrets). | Owner |
| 4 | **First end-to-end sign-in**: F5 (or `npm run dev`), open DigiDocs from the launcher (same tab); press "Back to OnePortal" (lands on the hub's home page); the browser's Back button returns to DigiDocs, signed in again without a prompt. Then `UI_BASE_URL=http://localhost:3008 E2E_EMAIL=… E2E_PASSWORD=… npm run test:ui` to check the signed-in home page at all 7 widths. | Owner, after #1–#3 |
| 5 | **DigiDocs's own requirements**: what it does, its roles, its tables. | Owner |
| 6 | `npm audit`: 3 moderate in production dependencies (`sprintf-js` via `tedious` via `mssql`; the only fix offered downgrades `mssql` to 4.2.0) and 5 high in development dependencies (`fast-glob` via `eslint-config-next`). Same packages as the hub; follow the hub's decision. | With the hub |
| 7 | No test on a real phone or tablet yet (only headless Edge at phone widths). | Before go-live |
| 8 | Not under git yet. | Owner |
| 9 | Hosting not decided: DigiDocs needs its own host name with HTTPS in production (ARCHITECTURE.md §11). | Before go-live |
| 10 | ~~**`DigiDocsOPnext` already has tables** (owner, 2026-10-07). Before `0001_initial.sql` runs there, run the read-only check in `database/README.md` step 1. If `schema_migrations`, `user_accounts` or `user_sessions` exists, send its columns (or the other DigiDocs project's schema script): 0001 is changed before it runs, and DigiDocs's users may need to link to an existing user table instead (hub CHILD-APP-GUIDE §5.2, `OnePortalUserId`).~~ Superseded 2026-10-07: `DigiDocsOPnext` is no longer used (#14). | Owner, before #2  **Re-opened 2026-10-07:** the database is `DigiDocsOPNext` after all; see #14.  **Done 2026-10-07:** the existing tables are exactly 0001 (applied 2026-10-06 16:58; 1 account, 7 sessions). |
| 11 | **The test-users seed and `data:clear` have never run against a database.** On a test installation: `npm run test-users:seed` here, then the hub's seed with `--file …/database/seed/test-users.json --app <App ID>` (`database/README.md`). | Owner, after #2 |
| 12 | **PM2 never started** (Claude does not run it). On a server: `npm install -g pm2`, `npm run pm2:start`, `pm2 save`, `pm2 startup`; `npm run pm2:reload` after each deploy. | At deploy |
| 13 | The home page (welcome panel) has not been seen rendered: it needs a hub and a database. Only `/sso/error` was screenshotted (375 and 1440 px). Look at the home page once on a phone after #4. | With #4 |
| 14 | **Migrations 0002 and 0003 applied to `DigiDocsOPNext` on 2026-10-07** (by Claude, with the owner's go-ahead; 35 organisations). Still to do: `npm run admin:grant` for the first LFZ Admin, assign roles, see every screen. Original item: **Module 1 has never run against a database.** In `DigiDocsOPNext` (it already has tables, #10): check `schema_migrations` and the columns of `user_accounts`/`user_sessions`, then migrations 0002 and 0003 (0001 only if not recorded) (`database/README.md`); open DigiDocs once from OnePortal; `npm run admin:grant -- --email <you>`; then assign roles on Administration → Users. Supersedes #2 and #10 (`DigiDocsOPnext` is no longer used). | Owner |
| 15 | The kit has no select field; Administration → Users uses plain `<select>`s with the kit's `inputClasses` (as the hub's own lists do). Add a `SelectField` to the hub's `action-form.tsx` (with label and field error), then copy it here and use it. | Hub, when convenient |
| 16 | Old organisation data seeded as it was: duplicates (CNC Engineering: legacy 12 and 41; Free Zone Utilities: 16 and 92), placeholder registration/licence numbers ("RC 1018080", "OP.LIC No. 0530/003/081") on the 2025 entries, every licence expiry in the past. Review on Administration → Organisations; deactivate the duplicates nobody uses. | Owner / LFZ |
| 17 | The administration screens (Users, a user, Organisations, Add organisation, an organisation) and `/no-access` have not been seen rendered — they need a database and a hub. Check them with #4 and the signed-in UI check (pages are in its list). | With #14 |
| 18 | ~~**Apply 0004 and 0005 to `DigiDocsOPNext`**~~ Done 2026-10-08 (with 0006). Still to do: look at Administration → Reference data: 6,836 HSE codes, 195 countries, 153 currencies, 36 states, 16 free zones, 270 ports, 32 units, 46 document types, 17 transaction types, 39 clearing agents, 8 banks. | Owner (or Claude with go-ahead) |
| 19 | HSE code rates are the 2022 tariff (valid 2022-01-01 to 2022-12-31 for every code). Confirm they are still the rates to show, or provide the current tariff (a new migration). | Owner / LFZ |
| 20 | **Choose the Lagos Free Zone theme in OnePortal** (Administration → Appearance: offer Lagos and make it the default), then open DigiDocs from the launcher: its colours follow (the theme is taken at sign-in). | Owner |
| 21 | The signed-in pages (dashboard, sections, "coming" pages) have not been seen rendered: there is no test sign-in. Look at them at 375 and 1440 px; run the signed-in UI check once a test person exists (#11). Enterprise-only and Account-only pages need a test person with that role. | Owner, with #11 |
| 22 | ~~If real dropdown menus are wanted later: add a dropdown to the hub's kit first~~ Superseded 2026-10-08: DigiDocs has its own header with dropdowns (decision log). If other suite applications want this header, move it into the hub's kit then. | — |
| 23 | **Try the Master screens against the database**: add, edit, deactivate a bank, an agent and a port; adding a duplicate active name must be refused. Then check Administration → Reference data still shows the counts. | Owner |
| 24 | The signed-in header and pages were checked on a temporary preview only (no database). Look at them signed in at 375 and 1440 px with the Lagos theme (#20). | Owner |
| 25 | **Apply `0007_imports_exports.sql` to `DigiDocsOPNext`** (`database/README.md`, with `-f 65001`). Until then List Import, List Export **and the LFZ Admin dashboard** fail with "Invalid object name dbo.imports" (the owner saw it on the list on 2026-10-08). 0007 was changed on 2026-10-08 before being applied (transaction direction). Then open both lists as LFZ Admin (empty: "No imports yet"), and `/imports?step=pending-lfz` from a dashboard card. | Owner |
| 26 | ~~The dashboard cards still show 0: the counting query is not written.~~ Done 2026-10-08 (`countImportsByStatus`). | — |
| 27 | The list pages have never shown a row: there is no way to create an import or export yet. Check the table at 320, 375 and 1440 px (hidden columns repeated under the tracking number, remarks in red) once Add Import exists, and an Enterprise user seeing only their organisation's rows. | With Add Import |

---

## 4. Session log

### 2026-10-08 — Imports and exports apart; dashboard filter (Claude Code)

**Reported by the owner:** the list page showed "Something went wrong" (dev log: `Invalid object name
'dbo.imports'` — 0007 not applied, #25); imports and exports are different, each with its own table
and mapping tables; the dashboard filter did not work.

**Found:** the separate tables were already so; but nothing stopped an import from carrying an export
transaction type. The dashboard filter did submit, but every card was a fixed 0 (#26), and with
JavaScript there was no button.

**What was done**
- 0007 (not applied, so changed in place): `transaction_direction` fixed per table (CHECK) in a composite
  foreign key to `transaction_types (id, direction)` (new unique index there).
- `features/submissions` split: `features/imports/queries.ts` (list + `countImportsByStatus`),
  `features/exports/queries.ts` (list); shared filter, scope and row in `features/workflow/list.ts`.
- Dashboard: real counts (`cardCounts`), a visible Filter button. Decision log: two entries.
- Tests: direction constraints in 0007; card sums.

**What was run**
- typecheck, lint — pass. `npm test` — 90 passed (9 files). build — pass. `npm run test:ui` — 1 passed, 19 skipped (signed-in).

**What was not checked**
- Nothing against the database: 0007 is still not applied (#25), so the dashboard now fails the same way as the lists until it is.

### 2026-10-08 — Header stripe and compact page headers with breadcrumbs (Claude Code)

**Asked and decided with the owner:** the stripe red, grey, blue in every theme (it followed the
theme: black/grey/white in Classic, which the owner still uses — #20); a small page header with a
breadcrumb on every signed-in page, no big "Dashboard" title. Decision log 2026-10-08 (two entries).

**What was done**
- `app-header.tsx`: stripe in the logo's fixed colours.
- `src/app/(app)/page-title.tsx` (`PageTitle`, `Breadcrumbs`) and `menuTrail` in `features/access/menu.ts`;
  every signed-in page uses it (home, lists, Add/edit pages, administration, "coming" pages,
  /no-access); the "← back" links and `BackLink` removed (the breadcrumb replaces them).
- `tests/unit/menu.test.ts`: breadcrumb trails.

**What was run**
- typecheck, lint — pass. `npm test` — 89 passed (9 files). build — pass. `npm run test:ui` — 1 passed, 19 skipped (signed-in).
- A temporary preview page (header + two page titles, no database) on the owner's running dev
  server (3008; not stopped), screenshots in Classic and Lagos at 1440 px and Classic at 375 px,
  looked at: stripe red-orange/grey/navy in both themes, breadcrumbs wrap, no sideways scroll.
  The preview page was deleted afterwards.

**What was not checked**
- The real pages signed in (#21, #24).

### 2026-10-08 — List Import and List Export (Claude Code)

**Asked and decided with the owner:** tables with the list columns only (form fields come with Add
Import/Export); statuses as a fixed list in code (old 10/11 merged); visibility as old ImpExp_G
with "Enterprise Submit" only for the enterprise; no row actions until View/Edit/Delete exist. A
conflict found while testing — the dashboard counts "Saved by NEPZA" as pending from NEPZA but old
ImpExp_G hid it from LFTZ — the owner chose that an LFZ Admin sees it. Decision log 2026-10-08
(three entries).

**Read (old project and DigidocsNext, read-only):** `T_ImpExp`, `Map_ExportKeyInfo`, `T_Exp`,
`M_WorkFlowStatus` (ids 2-13), procedures `ImpExp_G`, `GetDashBoardCount`,
`GetImpExpListUsingSteps`; views `ImpExp/ListImpExp`, `Export/ListExport`; DigidocsNext's
`import-list.tsx`, `export/page.tsx`, `transactions-table.tsx`, `workflow.ts`, `dashboard.ts`.
`Map_Export_List_G` (old export list) is not in the dump; the export list follows the import rules.

**What was done**
- `0007_imports_exports.sql`: `imports`, `exports` (organisation, creator, transaction type,
  tracking number unique per table, CHECKed `status_key`, reason, `form_saved_at`, `submitted_at`).
  **Written, not applied.**
- `features/workflow/statuses.ts` (keys, old labels, tones, rejected statuses, `VISIBLE_STATUSES`,
  `listableStatuses`); `features/dashboard/steps.ts`: each card's statuses.
- `features/submissions` (filter schema; `listImports`/`listExports`, scoped to the organisation for
  an Enterprise user); `src/app/(app)/submission-list.tsx`; `/imports` and `/exports` replace
  their "coming" pages (search, status, particular, enterprise, dashboard step, pager; "Add
  Import/Export" button for an Enterprise user, still to a "coming" page).
- Menu: List Import / List Export no longer "coming". Clear parts: new `imports-exports`;
  `test-users` and `people` delete the imports/exports pointing at the people they delete.
- `tests/unit/submissions.test.ts` (statuses = the CHECKs; visibility = old ImpExp_G with the two
  recorded changes; filters); UI check list: `/imports?step=pending-lfz`, `/exports?status=completed`.
- No new test user: no new role or attribute.

**What was run**
- `npm run typecheck`, `npm run lint` — pass. `npm test` — 87 passed (9 files); first run refused an
  em dash in 0007's header (fixed) and caught the "Saved by NEPZA" conflict above.
  `npm run build` — pass. `npm run test:ui` — 1 passed, 19 skipped (signed-in).

**What was not checked**
- 0007 against SQL Server, and both list queries (#25); a list with rows (#27); any signed-in page
  rendered (#21). No preview page was made this time.

### 2026-10-08 — LFZ header, dashboard like the design, masters (Claude Code)

**Asked and decided with the owner:** the screenshot comes from `D:\Khushiyal\DigidocsNext` (a
separate rewrite on the old stored procedures, read-only here); rebuild DigiDocs's header like it, as a
recorded exception to the suite shell; dashboard like it (other things removed); add its masters now.
Decision log 2026-10-08 (three entries).

**Read (DigidocsNext, read-only):** `CLAUDE.md`, `components/app-header.tsx`, `brand-stripe.tsx`,
`globals.css` (brand colours), `(app)/dashboard` (page, filters), `lib/dashboard.ts` (live card
definitions), `(app)/layout.tsx` (footer).

**What was done**
- `src/app/(app)/app-header.tsx` (stripe, logo row, person menu, menu row with dropdowns, phone menu)
  and the footer in `layout.tsx`; `features/access/menu.ts` with the old labels (Dashboard ▾ = reports;
  Master: Add Agent, List Agent, Ports, Banks; Administration ▾); section tabs and their layouts removed.
- Home: LFZ Admin dashboard (filters applying on change via `auto-submit-select.tsx`, five coloured
  cards → `/imports?step=…`); other roles: shortcut cards. `features/dashboard/steps.ts` = the live cards.
- Module 3: `features/masters` (schemas, queries, writes, actions), pages `/master/banks(/[id])`,
  `/master/agents(/new, /[id])`, `/master/ports(/[id])`, shared `master-ui.tsx`; audit event types;
  the list pager moved to `src/app/(app)/pager.tsx`.
- Tests: `menu.test.ts` rewritten (labels, items per role), `masters.test.ts`; UI check list updated.

**What was run**
- typecheck, lint — pass (after clearing stale `.next/dev` route types; DigiDocs's dev server was not running).
  `npm test` — 81 passed (9 files). build — pass. `npm run test:ui` — 1 passed, 17 skipped (signed-in).
- A temporary preview page (no database) of the header and dashboard layout in the Lagos theme,
  screenshots at 1440 px (Master dropdown open) and 375 px (phone menu open), looked at; no sideways
  scroll at either width. The preview page was deleted and the build re-run.

**What was not checked**
- The Master screens against the database (#23); any page signed in (#24).

### 2026-10-08 — Menus and dashboard like old DigiDocs (Claude Code)

**Asked and decided with the owner:** sections with tabs (no dropdowns); dashboard with zeros and
"Show sample data" until imports exist; every old menu item shown, unbuilt ones with a "coming"
page; Lagos theme chosen in OnePortal and the LFZ logo on DigiDocs pages. Decision log 2026-10-08.
The owner's account (khushiyal.vishwakarma@edgeaxis.in) was already LFZ Admin (granted 2026-10-07
and 2026-10-08; read-only check) — nothing to assign.

**Read (old project, read-only):** `_LayoutFinal.cshtml` (menus for role ids 1, 2, 3, 5),
`Home/DashBoardCount.cshtml` and procedure `GetDashBoardCount` (five steps by status), the logo
`DesignFinal/img/lagos.png` (copied to `public/lfz-logo.png`).

**What was done**
- `features/access/menu.ts` (sections and tabs per role, "coming" text), `requireMenuItem` guard,
  top bar from the menu (inline from `xl`, own scrolling row below).
- Sections `/reports`, `/imports`, `/exports`, `/master` with tab layouts and 15 "coming" pages
  (`src/app/(app)/section.tsx`); `/master` → `/master/agents`.
- Home: welcome panel with the LFZ logo; dashboard (filters, sample switch, 5 step tiles linking to
  `/imports?step=…`, total, status summary); `features/dashboard` (steps, sample figures, filter schema);
  `listTransactionTypeOptions`. NIS: welcome only.
- LFZ logo also on `/sso/error`.
- `tests/unit/menu.test.ts` (a page for every menu entry, tab roles ⊆ section roles, old menus,
  dashboard rules); UI check list: 16 signed-in pages.

**What was run**
- typecheck, lint — pass. `npm test` — 76 passed (7 files). build — pass (30 routes).
  `npm run test:ui` — 1 passed, 16 skipped (signed-in). Screenshot of `/sso/error` at 1440 px, looked at.

**What was not checked**
- Any signed-in page rendered (#21).

### 2026-10-08 — Module 2: reference data (Claude Code)

**Asked and decided with the owner:** clearing agents and banks copied now (screens in module 3);
suppliers not copied (test data); the lists are fixed data; a read-only page for LFZ Admins.
Decision log 2026-10-08.

**Read (old project, read-only):** the reference tables in `digidocs-09Mar26.sql`, which old code
uses them (`M_Currency_G` for currencies; `M_CategorySubCategory` only exposed by the API, never by
the web app), and their data (types 27/28 = sea/air port, 20/21 = solid/liquid unit, particular
type 1/2 = import/export).

**What was done**
- `0004_reference_lists.sql` (12 tables + data) and `0005_hse_codes.sql` (6,836 codes in 7 batches),
  generated by a script from the dump (scratch, not kept); `legacy_id` on every copied row.
- `features/reference/` (counts, HSE search) and `/admin/reference` (tab "Reference data").
- `tests/unit/reference.test.ts`: HSE batches ≤ 1,000 rows and unique codes; required-document
  links point at inserted rows; one row per currency; search filters.
- Clear parts: none for reference data (comment); UI check: `/admin/reference`, `?q=0101`.

**What was run**
- `npm run typecheck`, `npm run lint` — pass. `npm test` — 67 passed (6 files); the naming check
  first refused `type_name` (fixed). `npm run build` — pass. `npm run test:ui` — 1 passed, 6 skipped (signed-in).

**Applied to `DigiDocsOPNext`** (owner's go-ahead each time; `sa`, password from `.env.local`, never printed):
- 0004 and 0005: "applied"; counts verified (6,836 / 195 / 153 / 36 / 16 / 270 / 32 / 46 / 17 / 116 / 39 / 8).
- **Mistake found and repaired:** they were run without `sqlcmd -f 65001`, so the UTF-8 files were read
  as Windows-1252 and 21 values with accents or curly quotes were stored garbled (ö → "Ã¶"; checked by
  code point and length). Applied migrations are not edited: `0006_fix_special_characters.sql`
  rewrites the 21 values from the dump, spelled with `NCHAR(code)` so the file is pure ASCII; applied
  with the go-ahead. Verified: tögrög, Gökçen, São Tomé, m² by code point; 0 garbled values left in
  any reference table (binary comparison). 0001–0003 had no such characters in data.
- Prevention: README commands all carry `-f 65001`; `tests/unit/reference.test.ts` refuses a
  non-ASCII character in any migration from 0006 on; CLAUDE.md rule.

**What was not checked**
- The Reference data page not seen rendered (needs a sign-in).

### 2026-10-07 — Database corrected to DigiDocsOPNext; migrations 0002–0003 applied (Claude Code)

- Owner: the database is `DigiDocsOPNext` (`DigiDocsDBNext` was a mistake; `sqlcmd` as `sa` could not open it). Renamed in `.env.example`, `create_database.sql`, migration headers (comments only), README, CODEBASE-GUIDE, CLAUDE.md, the `config.ts` comment; decision log: correction entry. History entries left as written.
- With the owner's explicit go-ahead, against `localhost,1433` / `DigiDocsOPNext` as `sa` (password read from `.env.local`, never printed):
  - Read-only check: `schema_migrations` (0001, 2026-10-06 16:58), `user_accounts`, `user_sessions` — columns and constraints exactly those of 0001; 1 account, 7 sessions.
  - `0002_access.sql` failed first: `sqlcmd` starts with `QUOTED_IDENTIFIER OFF` and filtered indexes need it ON (Msg 1934). The transaction rolled back (checked: still only 0001, no new columns). Added `SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;` to 0002 and 0003 (never applied, so editable).
  - Then `0002_access applied.` and `0003_enterprises applied: 35 organisations.` Verified: migrations 0001–0003 recorded; tables `audit_events`, `organisations` (35), `schema_migrations`, `user_accounts`, `user_sessions`.
- Not done: `admin:grant` — the one account (Khushiyal Vishwakarma) is for the owner to promote.

### 2026-10-07 — Module 1: roles, users, organisations (Claude Code)

**Asked and decided with the owner:** new empty database `DigiDocsDBNext` (was `DigiDocsOPnext`);
a clean schema in the suite's conventions; only reference data copied from the old database; start
with the foundation; access assigned by an LFZ Admin after the first sign-in; one role per person;
admins create organisations (no self-registration); uploaded files in a server folder, built with
the first module that needs them. Decision log 2026-10-07 (six entries).

**Read (old project, read-only):** `WEB/Controllers`, `WEB/Views`, `Views/Shared/_LayoutFinal.cshtml`
(menus per role), `Database/digidocs-09Mar26.sql` (UTF-16 dump: 57 tables, 85 procedures, data).
Found: all organisations typed "NEPZA" (type unusable); LFZ Admin/NEPZA/Account users all in
organisation 1 (the zone operator); department, reporting-to and HOD stored but unused; licence
and permit paths never set; signature image used on approval letters.

**What was done**
- `0002_access.sql`: `organisations`; `user_accounts` + `role_key` (CHECK), `organisation_id` (FK;
  CHECK: only and always for `enterprise`), `mobile_number`; `audit_events`. `0003_enterprises.sql`:
  35 enterprises from the old dump (organisation 1 left out), with `legacy_id`.
- `features/access/roles.ts` (5 roles); session reads role and organisation (a deactivated
  organisation reads as no role); guards `requireMember`, `requireRole`.
- `features/organisations` (list with search/status/paging, add, edit, deactivate), `features/users`
  (list with search/role/status, set role/organisation/mobile/active; self-protection; deactivation
  ends sessions), `features/audit/record.ts`.
- Pages: `/no-access`, `/admin` → `/admin/users`, `/admin/users`, `/admin/users/[id]`,
  `/admin/organisations`, `/admin/organisations/new`, `/admin/organisations/[id]`; home shows role
  and organisation, and for an LFZ Admin who is waiting; "Administration" in the top bar for LFZ Admins.
- `scripts/grant-admin.ts` (`npm run admin:grant`) for the first LFZ Admin.
- Test users: 7 (one per role, two Enterprise users in LPLELTD and INS, one waiting); the seed sets
  role and organisation; clear parts + `audit`.
- `create_database.sql`, `.env.example`, README, docs → `DigiDocsDBNext` (history entries left as written).

**What was run**
- `npm run typecheck` — pass. `npm run lint` — pass. `npm test` — 63 passed (5 files; new
  `access.test.ts`: roles = the migration's CHECK, access rules, organisation fields, filters).
- `npm run build` — pass (13 routes). `npm run test:ui` — 1 passed (`/sso/error`), 4 skipped (signed-in pages).
- Smoke test without a database: `/admin`, `/admin/users`, `/admin/organisations/new`, `/no-access`
  → 307 to `/sso/login?returnTo=…`; with a session cookie and no database → 500 (the error page, as designed).

**What was not checked**
- Anything against SQL Server (both migrations, the seed, `admin:grant`, every query); the new
  screens rendered (#17).

### 2026-10-07 — Kit v3 → v7 (Claude Code, following the hub's `docs/CHILD-APP-SETUP-FOR-CLAUDE.md` §10)

**What was done**
- Confirmed with the owner: DigiDocs, `digidocs`, port 3008, hub `D:\Khushiyal\next-oneportal`; database **`DigiDocsOPnext`** (already has tables — #10).
- Compared every kit file with the hub's (ignoring line endings): only the hub's v4–v7 changes and DigiDocs's own adaptations differed; nothing of DigiDocs's was lost.
- **v4:** re-copied `globals.css`, `src/themes/*`, `primitives.tsx`, `button.tsx`, `action-form.tsx`, `copy-field.tsx`, `brand.tsx`, `nav-links.tsx`, `themes.test.ts`; new `charts.tsx`, `chart-math.ts`, `auth-shell.tsx`, `charts.test.ts`. Merged: `user-menu.tsx` (rem), `sso/auth-card.tsx` (now identical to the hub's), `sso/layout.tsx` (`<AuthShell>`, DigiDocs's own headline and three points). Home page: `<Hero>` + `<SectionHeader>` + the empty state (no numbers yet). px font sizes → rem in `sso/error`. No graphs existed.
- **v5:** re-copied `src/lib/schemas.ts`; added `src/app/sso/leave/route.ts`; header link and user menu → "Back to OnePortal" (`/sso/leave`, plain `<a>`); deleted `src/features/auth/actions.ts` (`signOut`) and `src/app/sso/signed-out/`; Playwright waits for `/sso/error`; the UI check's list no longer has `/sso/signed-out`.
- **v6:** copied `src/lib/test-users.ts`, `src/lib/data-clear.ts`; merged `ALLOW_DATA_CLEAR` (+ start-up warning) into `config.ts` and `.env.example`. Wrote `database/seed/test-users.json` (3 users, no roles: DigiDocs has none), `src/features/auth/schemas.ts` (`appTestUserSchema`), `saveTestUser` in `link-user.ts`, `scripts/seed-test-users.ts`, `src/features/maintenance/clear-parts.ts` (`test-users`, `people`, `sessions`), `scripts/clear-data.ts`, `tests/unit/test-users.test.ts`; npm scripts `test-users:seed`, `data:clear`. **Not run.**
- **v7:** `ecosystem.config.cjs`, `logs/.gitignore`; re-copied `eslint.config.mjs` (`.cjs` rule); `npm install -D dotenv` (^17.4.2); six `pm2:*` scripts (`pm2:logs` → `digidocs`); `# pm2` lines in `.gitignore`. **PM2 not started.**
- Kit files identical to the hub's had their header bumped v3 → v7; adapted files say "adapted … v7".
- Database name → `DigiDocsOPnext` in `.env.example`, the `config.ts` comment, the `0001` header (never applied), `database/README.md` (check query, login, test users).
- Docs: ARCHITECTURE (entry points, tree, §6 no sign-out, §8d test installations, checks, §11 PM2, four decision-log entries), CODEBASE-GUIDE (rewritten), AUDIT (pass 2026-10-07), CLAUDE.md (kit v7 rules), this file.

**What was run**
- `npm run typecheck` — pass (after deleting `.next/`: the previous day's dev route types still named the deleted page). `npm run lint` — pass.
- `npm test` — 50 passed (4 files: themes incl. chart colours, charts, SQL names, test users/clear parts).
- `npm run build` — pass (routes `/`, `/sso/callback`, `/sso/error`, `/sso/leave`, `/sso/login`, proxy).
- `npm run test:ui` — 1 passed (`/sso/error` at 7 widths), 1 skipped (`/`: needs a hub and a database).
- Smoke test, production build on 3210, placeholder settings, no database: `/` → `/sso/login?returnTo=%2F`; `/sso/login` → hub authorize + `digidocs_sso_state` (`Path=/sso; Max-Age=600; Secure; HttpOnly; SameSite=lax`); wrong state → `/sso/error?reason=state`; `/sso/error` 200 `classic`, with `digidocs_theme=lagos` → `lagos`, unknown → `classic`; `/sso/leave` → 307 `http://localhost:3000` and clears `__Host-digidocs_session`; `/sso/signed-out` → 404.
- Leftover searches: palette classes — none in class names; px font sizes — none; sign-out — only comments; `target="_blank"` — none.
- `npm run dev` reported `http://localhost:3008`; `launch.json` parses, F5 = "Next.js: dev server" with `envFile`, browser URL :3008.
- PM2 config without PM2: `apps[0]` = name `digidocs`, args `start --port 3008`, logs `logs/digidocs.{out,err}.log`.
- Screenshots of `/sso/error` at 375 and 1440 px, looked at: new frame and wording, no sideways scroll.
- All servers stopped afterwards.

**What was not checked**
- Anything against SQL Server or a running hub; the home page rendered (#13); the seed and data clear (#11); PM2 (#12).

**Disagreements between the runbook/guide and the hub's code**
- Unchanged from 2026-10-06: the SQL-naming check's sanity floor (hub: 8 tables / 50 columns) does not fit a suite application; kept at 3 / 18 here.
- `next.config.ts` (kit) still lists `nodemailer` in `serverExternalPackages`; harmless.

### 2026-10-06 — Basic setup (Claude Code, following the hub's `docs/CHILD-APP-SETUP-FOR-CLAUDE.md`)

**What was done**
- `create-next-app@16.3.7` with the hub's flags; `mssql zod lucide-react server-only`; dev:
  `@types/mssql @types/node@24 vitest tsx @playwright/test dotenv-cli`. Package `digidocs`; the
  hub's scripts (no `admin:create`, no `test:integration` yet).
- Suite kit v3 copied from the hub with headers (§3 of the runbook). Adapted: `src/lib/config.ts`
  (OnePortal settings added, mail removed, `APP_NAME` DigiDocs, 8-hour sessions), `session.ts`
  (`digidocs_session` cookies, `SessionUser` without admin/theme), `guards.ts` (`requireUser` →
  `/sso/login`), `user-menu.tsx` (OnePortal account + Sign out), `/sso` layout and card,
  `not-found.tsx` (link wording), `playwright.config.ts`, `tests/ui/responsive.spec.ts`,
  `.vscode/launch.json` (browser URL :3008), and `tests/unit/sql-names.test.ts` (sanity floor —
  see "Disagreements").
- Written: `oneportal.ts`, `link-user.ts`, `actions.ts` (signOut), `active-theme.ts`, `proxy.ts`,
  `/sso/login`, `/sso/callback`, `/sso/error`, `/sso/signed-out`, `(app)/layout.tsx`, `(app)/page.tsx`.
- Database scripts: `create_database.sql` (DigiDocs / `digidocs_app`), `0001_initial.sql`
  (`user_accounts`, `user_sessions`), `purge_expired.sql`, `README.md`. **Not run.**
- Docs: ARCHITECTURE, CODEBASE-GUIDE, this file, AUDIT, CLAUDE.md.
- Settings: port 3008, hub `http://localhost:3000`, organisation EdgeAxis, short name `digidocs`.

**What was run**
- `npm run typecheck` — pass. `npm run lint` — pass (0 problems).
- `npm test` — 40 passed (2 files: themes, SQL names).
- `npm run build` — pass (routes `/`, `/sso/callback`, `/sso/error`, `/sso/login`, `/sso/signed-out`, proxy).
- `npm run test:ui` — 2 passed (`/sso/error`, `/sso/signed-out` at 7 widths), 1 skipped (`/`: needs a hub and a database).
- Smoke test, production build on port 3210 with placeholder settings and no database
  (`APP_URL=https://localhost:3210`, as production requires https):
  `GET /` → 307 `/sso/login?returnTo=%2F`; `GET /sso/login` → 307
  `http://localhost:3000/sso/authorize?app_id=…&state=…` with `digidocs_sso_state` cookie
  `Path=/sso; Max-Age=600; Secure; HttpOnly; SameSite=lax`; `GET /sso/callback?code=x&state=wrong`
  → 307 `/sso/error?reason=state`; `GET /sso/error`, `/sso/signed-out` → 200 with
  `data-theme="classic"`; `Cookie: digidocs_theme=lagos` → `data-theme="lagos"`; an unknown theme
  key → `classic`. CSP with `frame-ancestors 'none'` and `X-Frame-Options: DENY` present.
- `npm run dev` with the existing `.env.local` reported `http://localhost:3008`, then refused the
  placeholder `ONEPORTAL_APP_ID` (expected until #3). `.vscode/launch.json` parses; its first
  configuration is "Next.js: dev server" with `envFile` `${workspaceFolder}/.env.local`.
- All servers stopped afterwards.

**What was not checked**
- Anything against SQL Server (the session and user-linking SQL is unverified) or a running hub:
  the real code exchange, user creation, session start, sign-out, the signed-in shell rendered.
- `.env.local` already existed (a copy of `.env.example`, made during the session); it was left as is.

**Disagreements between the runbook/guide and the hub's code**
- `tests/unit/sql-names.test.ts` is listed as "no adapt", but its sanity floor (≥ 8 tables,
  ≥ 50 columns) is the hub's schema; a suite application's first migration has 3 tables and 18
  columns, so the check fails as copied. Lowered to 3 / 18 here and marked *adapted*.
- `next.config.ts` (kit, unchanged) lists `nodemailer` in `serverExternalPackages`; DigiDocs does
  not install it. Harmless (build passes).
- The runbook derives the database name from the short name in PascalCase (`Digidocs`); the
  application's name is `DigiDocs`, so the database is `DigiDocs` (SQL Server names are
  case-insensitive under the default collation).

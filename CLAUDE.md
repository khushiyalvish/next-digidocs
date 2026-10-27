@AGENTS.md

# DigiDocs — instructions for AI sessions

DigiDocs is an application in the OnePortal suite (suite kit v8). The hub is at
`D:\Khushiyal\next-oneportal`. Its database is `DigiDocsOPNext`.

DigiDocs rebuilds the old DigiDocs (ASP.NET MVC) at `D:\Khushiyal\Digidocs`, module by module
(`docs/PROGRESS.md` §1a). **Read the old project and its database dump
(`Database/digidocs-09Mar26.sql`, UTF-16) as reference only — never change anything there.** Each
module is re-designed to ARCHITECTURE.md: ask the owner before deciding what an old behaviour should
become; copy reference data only, as migrations.

Read before changing anything, in this order:

0. `docs/CODEBASE-GUIDE.md` — orientation: where things live, what to open, an error playbook.
1. `docs/ARCHITECTURE.md` — the rules this code follows (§0 principles are non-negotiable) and
   the dated decision log.
2. `docs/PROGRESS.md` — which stage the codebase is in, open items, and the session log.
   **Update it as part of the work, not afterwards.**
3. `docs/AUDIT.md` — the security audit. Read it before touching sign-in, sessions, access or
   anyone's data.
4. The hub's `docs/CHILD-APP-GUIDE.md` — the suite contract (sign-in, kit, look, screen sizes).

Rules that catch people out:

- Every server action, page and route handler starts with a guard from `src/features/auth/guards.ts` — `requireMember()` (any role) or `requireRole(...)`; `requireUser()` only for the shell and `/no-access` — then parses its input with the feature's zod schema — including ids (`idSchema`), hidden fields, `params` and `searchParams`.
- Sign-in only through OnePortal (docs: CHILD-APP-GUIDE.md in the hub). No login page, no passwords. `src/features/auth/oneportal.ts` is the only file that talks to the hub; people are linked by hub id, never by email.
- SQL only through `db.query\`…\`` / `withTransaction` (`src/lib/db.ts`); never concatenate SQL. No ORM.
- Each table has one writer (table in ARCHITECTURE.md §2). One-time things are consumed with one conditional `UPDATE … OUTPUT`.
- **No foreign keys** (decision log 2026-10-19): never add `FOREIGN KEY` / `REFERENCES` to a migration (a unit check refuses it). The writer checks every id it stores exists; nothing cascades, so whatever deletes rows deletes what points at them.
- Expiry and every comparison of instants is computed in SQL (`SYSDATETIMEOFFSET()`, `DATEADD`), never with `new Date()` in TypeScript.
- Schema changes are new files in `database/migrations/` named `NNNN_words.sql` that record their own id (a unit check enforces both); never edit an applied one. Keep them pure ASCII (any other character as `NCHAR(code)`; a unit check enforces it); they are applied with `npm run db:migrate` (or `sqlcmd` with `-f 65001`). **Never run anything against a database without the owner's explicit go-ahead** — they apply migrations themselves.
- Database commands (`db:migrate`, `db:seed`, `test-users:seed`, `data:clear`) are written by Claude and run only by the owner. Never run them, not even `db:migrate -- --status`.
- Settings only via `getConfig()` (`src/lib/config.ts`); add new ones there and in `.env.example`. Never edit `.env.local` (it holds the owner's secrets).
- Forms are `<ActionForm>` (`src/components/forms/action-form.tsx`); actions return `Result` (`src/lib/result.ts`).
- Roles are the fixed list in `src/features/access/roles.ts`, one per person. Only an Enterprise User has an organisation; from the Import module on, an Enterprise User's queries are scoped to it (out of scope reads as not found).
- Ids are lower-cased when read from SQL Server; compare ids as lower-case strings.
- Colours only as theme tokens (CHILD-APP-GUIDE §7.2): `bg-surface`, `text-ink`, `bg-primary`…, never palette classes such as `zinc-900` or `bg-white`. Red/amber/green only via `danger`/`warning`/`success`, for meaning. Reuse `src/components/ui`. No exceptions (the LFZ stripe and logo were removed: decision log 2026-10-12).
- The port is `PORT` in `.env.local` (dotenv-cli in the npm scripts, `envFile` for F5); never put it in `package.json`. Development port: 3008.
- Every page works from 320 px to 2560 px+ (ARCHITECTURE.md §0.9): mobile-first classes, no sideways scroll, tables via `showFrom`, never shrink input text below 16 px on phones. Add new pages to `tests/ui/responsive.spec.ts`.
- Font sizes in rem, never px; graphs only from `src/components/ui/charts.tsx`, by the rules in CHILD-APP-GUIDE §7.4 (with a "Show sample data" switch).
- The signed-in header (`src/app/(app)/app-header.tsx`) is the suite shell — OnePortal's bar, the kit's `Brand` and `UserMenu` — with one recorded difference: DigiDocs's sections are dropdowns (decision log 2026-10-12). Keep it on theme tokens, keep "Back to OnePortal" and "OnePortal account" in it, and add menu entries only in `src/features/access/menu.ts`. Page headers are `PageTitle` (`src/app/(app)/page-title.tsx`) with a `menuTrail(...)` breadcrumb, not the kit's `PageHeader`.
- No sign-out in DigiDocs: "Back to OnePortal" is a plain `<a href="/sso/leave">`, never `<Link>` (a prefetch would end the session). Links to the hub or another suite application never use `target="_blank"`.
- A new role, supervisor link or other attribute people are told apart by gets a test user in `database/seed/test-users.json` and its write in the seed (`saveTestUser`), in the same change (CHILD-APP-GUIDE §5.8). The file holds the suite's test team with exactly the hub's ids, addresses and names; DigiDocs's own extras are `digidocs.*@oneportal.test`. Never run the seed: it runs against a database.
- A new table people work in gets sample records in `npm run db:seed` (`database/seed/sample-data.json`, `src/features/sample-data/`), by the rules in CHILD-APP-GUIDE §5.10, in the same change.
- A new table gets a part in `src/features/maintenance/clear-parts.ts`, or joins one, in the same change (CHILD-APP-GUIDE §5.9). Never run `npm run data:clear`.
- Never run PM2 (`npm run pm2:*`, `npm install -g pm2`): it starts a process that outlives the session. The owner starts it.
- Suite kit files are copied from OnePortal — change them in the hub first. They carry a `// Suite kit vN:` header (v8 for files changed in v8); "copied" files are replaced on upgrade, "adapted" ones are merged by hand.
- To update the kit, follow `D:\Khushiyal\next-oneportal\docs\CHILD-APP-SETUP-FOR-CLAUDE.md`.

How to work here:

- **Look before you write.** Search for an existing function, type or pattern first. If the logic exists, use it or extract it — never copy it.
- **If a request conflicts** with a rule, a principle or a recorded decision, say so and ask. Do not quietly pick one. Reversing a decision is allowed — as a new entry in the decision log.
- **Stay in scope.** Note unrelated problems as open items in PROGRESS.md; do not fix them inside the same change.
- **The code is the fact.** If a doc and the code disagree, fix the doc in the same change, or flag it.

Before finishing:

- Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run test:ui` (after the build; UI changes).
- Say what you ran and what you did not (or could not) run. Never report a check as passing if you did not run it.
- Update PROGRESS.md (session entry, open items), the decision log if you decided something, and AUDIT.md if security-relevant behaviour changed.

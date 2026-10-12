# Security audit

A record of what was reviewed for vulnerabilities, data exposure, and one person reaching
another's data — what was wrong, what was fixed, and which risks are knowingly accepted. Each
pass adds a dated section; **nothing is rewritten**.

Rules it audits against: [ARCHITECTURE.md](./ARCHITECTURE.md) §6 and §8, and the hub guide's
security rules (`D:\Khushiyal\next-oneportal\docs\CHILD-APP-GUIDE.md` §6).

---

## Passes

| Date | Depth | Covered | Not covered |
|---|---|---|---|
| 2026-10-08 (import and export lists) | **Light, by the author while building** | `/imports`, `/exports` against the four questions (below); the Enterprise scope and the status rules pinned by unit checks | Nothing run against a database (0007 not applied); no rows to see; no independent reviewer |
| 2026-10-07 (module 1) | **Light, by the author while building** (roles, users, organisations) | The new entry points below against the four questions; self-protection of LFZ Admins; deactivation (person: sessions end; organisation: role reads as none); the bootstrap command | Nothing run against a database; the screens not seen rendered; no independent reviewer |
| 2026-10-07 | **Light, by the author while upgrading** (kit v3 → v7) | The new entry points (`/sso/leave`, the two scripts) and the removed ones; `/sso/leave` and the removed `/sso/signed-out` checked over HTTP; the seed's and the clear command's guards read against hub guide §5.8–§5.9; the PM2 file's handling of secrets | Nothing run against a database or a running hub; the seed and the clear command never run; PM2 never started |
| 2026-10-06 | **Light, by the author while building** (basic setup) | Every entry point below against the four questions; the hub guide §6 rules; cookies and headers checked over HTTP on the production build; `npm audit` | Nothing run against a database or a running hub; no penetration test; no independent reviewer; no reverse proxy / hosting configuration (not decided) |

---

## 1. What was checked

### Entry points

Enumerated with:

```bash
grep -rl '^"use server"' src | xargs grep -hn "^export async function"   # server actions
find src/app -name "route.ts" -o -name "page.tsx"                          # routes and pages
```

2026-10-06: 1 server action, 3 pages, 2 route handlers, the proxy. 2026-10-07: 0 server actions, 2 pages, 3 route handlers, the proxy, 2 scripts. 2026-10-07 (module 1): 3 server actions, 9 pages, 3 route handlers, the proxy, 3 scripts.

| Entry point | Guard runs first? | Input parsed by schema? | Query scoped to the caller? | Output mapped field by field? |
|---|---|---|---|---|
| `src/proxy.ts` | n.a. — checks only that a session cookie exists; a convenience | path + query passed on as `returnTo` | n.a. | redirect to `/sso/login` (same site) |
| `GET /sso/login` | n.a. — starts creating the caller | `returnTo` through `safeNextPath` | n.a. | redirect to the configured `ONEPORTAL_URL` only; state cookie `HttpOnly`, `SameSite=Lax`, `Path=/sso`, 10 min, `Secure` on HTTPS |
| `GET /sso/callback` | n.a. — the code, redeemed with the app secret, is the credential | `state` compared with the cookie (absent = launch from the hub tile); code sent only to the hub; hub response is the only source of identity | person found **by hub id** (`hub_user_id`); deactivated → refused | redirect to the stored `returnTo` through `safeNextPath`; errors to `/sso/error?reason=…` |
| ~~`auth.signOut`~~ | removed 2026-10-07 (kit v5) | | | |
| `GET /sso/leave` (2026-10-07) | n.a. — ends only the caller's own session (cookie token hash) | no input | own session only | redirect to the configured `ONEPORTAL_URL` only; session cookie cleared. A GET on purpose: a planted link can only end the person's own DigiDocs session, and the next page signs them in again through the hub. Linked only with plain `<a>` (no prefetch) |
| `/` | `requireUser` | no input | caller's own name only | n.a. |
| `/sso/error` | n.a. | `reason` via a zod enum with `.catch` | n.a. | fixed messages only; never redirects by itself |
| ~~`/sso/signed-out`~~ | removed 2026-10-07 (kit v5); answers 404 (checked over HTTP) | | | |
| `scripts/seed-test-users.ts` (2026-10-07) | operator's own database access; run by a person, never by the app | the whole file parsed with `testUsersFileSchema(appTestUserSchema)` first: `@oneportal.test` addresses only, ids and emails unique | only rows found by a hub id from the file, and updated only while their address is `@oneportal.test`; a real person's row is never touched (the run fails instead); one transaction | prints a count |
| `users.saveUserAccess` (module 1) | `requireRole("lfz_admin")` | `userAccessSchema`: role from the fixed list; organisation dropped unless Enterprise, required for Enterprise; ids as GUIDs; mobile digits only | admin: every person; refuses changing one's own role or status; the organisation must exist and be active (unless unchanged); deactivation revokes all sessions in the same transaction; audited | Result only |
| `organisations.createOrganisation` / `saveOrganisation` (module 1) | `requireRole("lfz_admin")` | `createOrganisationSchema` / `updateOrganisationSchema` (dates checked, short code upper-cased) | admin: every organisation; audited | redirect / Result |
| `/admin/*` pages, `/` (module 1) | admin layout and every admin page `requireRole("lfz_admin")` (others: 404); `/` `requireMember` | `params` via `idSchema` (malformed → 404), list filters via schemas with `.catch` | admin: all; home: the caller's own role and organisation from the session | DTOs built field by field; no `hub_user_id` shown |
| `/admin/reference` (module 2) | `requireRole("lfz_admin")` | `q`, `page` via `hseSearchSchema` (`.catch`); `q` escaped for LIKE | reference data: nothing personal, not scoped | DTOs; read-only (no writer in the app) |
| Section pages `/reports/*`, `/imports*`, `/exports*`, `/master/*` (2026-10-08) | `requireMenuItem(href)`: the roles the menu gives the page (others: 404); section layouts too | no input ("coming" pages) | n.a. | fixed text |
| `/` dashboard (2026-10-08) | `requireMember` | `type`, `enterprise`, `sample` via `dashboardFilterSchema` (`.catch`) | an Enterprise User's enterprise is always their own (the address-bar choice is ignored); figures are 0 or sample until module 4 | counts only |
| `masters.createBank` / `saveBank` / `createAgent` / `saveAgent` / `createPort` / `savePort` (2026-10-08) | `requireMenuItem("/master/…")` (LFZ Admin) | `features/masters/schemas.ts` (names, email ≤ 50, phone 7–15 digits, port kind sea/air; ids as GUIDs) | reference data, not scoped; duplicate active names refused inside the writing statement | Result; audited (`master.*`) |
| `/no-access` (module 1) | `requireUser` (a person with a role is sent to `/`) | no input | the caller only | fixed text |
| `scripts/grant-admin.ts` (module 1) | operator's own database access | `emailSchema` | exactly one account with that email, else refused (email is not unique; identity is the hub id); audited with no actor | prints the name |
| `scripts/clear-data.ts` (2026-10-07) | operator's own database access; refuses unless `ALLOW_DATA_CLEAR=true` (warned in the server log at every start) | part names checked against the list; unknown names reported | whole categories only, fixed `DELETE`s, no condition from the command line; deletes only with `--confirm` naming the database SQL Server reports | counts first |

### Who may do what (module 1, 2026-10-07)

Role and organisation are re-read with the session on every request, so an administrator's change
applies at the person's next page. A person without a role, or whose organisation is deactivated,
reaches only `/no-access`. Only an Enterprise User has an organisation (a database CHECK); from the
Import module on, their records are filtered by it. Role changes are recorded in `audit_events`.

### Import and export lists (2026-10-08)

`/imports` and `/exports` start with `requireMenuItem` (the menu's roles; NIS and, for exports,
Account get 404) and parse every address-bar value with `submissionListFilterSchema` (ids with
`idSchema`, status and step from fixed lists; anything malformed is "no filter"). For an Enterprise
User the organisation filter is taken from the session and the `enterprise` value in the address
bar is ignored, so no other organisation's rows can be reached. Every role is limited to the
statuses `VISIBLE_STATUSES` gives it, intersected with any status or step chosen; an empty result
never runs the query. Search text goes through `containsPattern` (LIKE wildcards made literal) and
parameters. Rows carry no links or actions yet. Not checked: the queries against SQL Server.
The dashboard count (`countImportsByStatus`) is for LFZ Admins only (Home shows it to no other
role), counts only the statuses they see, and takes Particular and Enterprise as `idSchema` ids.

### PM2 (2026-10-07)

`ecosystem.config.cjs` reads only `PORT` from `.env.local` (parsed, not loaded), so the
connection string and `ONEPORTAL_APP_SECRET` never enter the environment PM2 stores and shows
(`pm2 env`, `pm2 save`). The file is committed and holds no setting.

### The theme cookie

`digidocs_theme` is set only by the callback, from the hub's token response, and only when the
key is in the kit's theme list (`isThemeKey`). It is read by `getActiveTheme`, which matches it
against the list again (`findTheme`; unknown → `classic`). Theme values come only from code
(`src/themes/*.ts`) and reach the page as React `style` values on `<html>`. Someone who edits the
cookie changes only their own colours — appearance only. Checked over HTTP: `lagos` → `lagos`,
an unknown key → `classic`.

### The hub guide's rules (§6)

1. Code exchanged on the server only (`redeemCode`, `server-only`); the secret is in `getConfig()` only, never `NEXT_PUBLIC_`.
2. Identity only from the token endpoint's response; nothing read from the callback's query except `code` and `state`.
3. `state` checked against an `HttpOnly`, `SameSite=Lax`, `Path=/sso`, 10-minute cookie (checked over HTTP: a wrong state → `/sso/error?reason=state`).
4. People linked by hub id; email refreshed, never used to link.
5. Own session started, then redirect only to a same-site path (`safeNextPath`). Session cookie `HttpOnly`, `SameSite=Lax`, `Secure` + `__Host-` on HTTPS, 8 hours.
6. Each code used once: no retry on failure; the error page never redirects to `/sso/login` by itself.
7. Nothing logs the code, the secret or the token response (only a fixed message on a 401). 10-second timeout.
8. Every page runs `requireUser()`.

### The usual suspects

- **Injection** — all SQL is `db.query` tagged templates (parameters).
- **Unsafe HTML** — no `dangerouslySetInnerHTML`, no `eval`.
- **Open redirects** — `returnTo` only as a same-site path (`safeNextPath`); sign-in redirects only to the configured hub URL.
- **CSRF** — server actions: Next.js `Origin` check; session cookie `SameSite=Lax`; sign-in `state`.
- **SSRF** — DigiDocs fetches only the configured `ONEPORTAL_URL`.
- **Framing** — `frame-ancestors 'none'`, `X-Frame-Options: DENY` (checked over HTTP).
- **Transport and headers** — the kit's `next.config.ts`: CSP, `Referrer-Policy: no-referrer`, `nosniff`, HSTS, `X-Powered-By` off.
- **Uploads** — none yet.

### Secrets and dependencies

- `.env.example` and `database/setup/create_database.sql` contain placeholders only. Not under git yet.
- `npm audit` (2026-10-06): production — 3 moderate (`sprintf-js` via `tedious` via `mssql`; the
  only fix offered downgrades `mssql` to 4.2.0); development — 5 high (`fast-glob` via
  `eslint-config-next`). See PROGRESS.md #6.

### Destructive scripts

`database/maintenance/purge_expired.sql` deletes only sessions past expiry or revocation (+1 day).

---

## 2. Findings

None in this pass.

## 3. Accepted risks

- **A launch from the hub tile carries no `state`** (hub guide §10): a planted link could sign a
  person into DigiDocs *as themselves*. Accepted, as in the hub; strict mode is a small change in
  the callback if DigiDocs ever needs it.
- **Signing out of OnePortal does not sign out of DigiDocs**, and a person deactivated in the hub
  keeps an open DigiDocs session until it expires (8 hours). For an immediate cut-off, deactivate
  them in DigiDocs too (`user_accounts.is_active`).

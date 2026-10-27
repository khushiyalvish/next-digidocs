# Database

SQL Server 2019 or later (developed against the 2022 syntax set; Express is fine).
The web app never changes the schema — a person runs these scripts.

## First time

DigiDocs uses the database **`DigiDocsOPNext`**.

1. **Create the database and the app's login** (DBA, sysadmin rights). Replace the password
   placeholder first:

   ```bash
   sqlcmd -S <server> -E -b -i database/setup/create_database.sql
   ```

   The login `digidocs_app` gets read/write on data only (no DDL). If the database already
   exists, the script only adds what is missing.

2. **Apply the migrations** with an account that can create tables (the app's own login cannot):

   ```bash
   npm run db:migrate -- --status   # lists applied and pending files; changes nothing
   npm run db:migrate               # applies the pending ones, in number order
   ```

   It connects with `MIGRATION_DATABASE_CONNECTION_STRING` from `.env.local` (an owner account,
   e.g. the one that ran `create_database.sql`), or with `DATABASE_CONNECTION_STRING` when that is
   unset (a development machine where that is already an owner account). It stops at the first
   file that fails; that file's own transaction is rolled back.

   The alternative, one file at a time, in number order (`0001_initial.sql` to the newest):

   ```bash
   sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0001_initial.sql
   ```

   **Always pass `-f 65001`** to sqlcmd: the files are UTF-8, and without it sqlcmd reads them in
   the Windows code page and stores accented characters wrongly (it happened to 0004–0005; 0006
   repairs it). In SSMS, open the file and Execute: SSMS reads UTF-8 correctly. `npm run
   db:migrate` reads them as UTF-8.

   Each file is transactional and records itself in `dbo.schema_migrations`; running it twice
   does nothing the second time, so the two ways can be mixed.

3. **Point the app at it**: `DATABASE_CONNECTION_STRING` in `.env.local` (see `.env.example`), e.g.

   ```
   Server=localhost,1433;Database=DigiDocsOPNext;User Id=digidocs_app;Password=…;Encrypt=true;TrustServerCertificate=true
   ```

4. **The first LFZ Admin**: open DigiDocs once from OnePortal (that creates your account here; you
   see "waiting for access"), then:

   ```bash
   npm run admin:grant -- --email you@company.com
   ```

   Reload DigiDocs. From then on, LFZ Admins give everyone else their role on the Users page.

`-E` uses Windows authentication; use `-U <login> -P <password>` for a SQL login.

### SQL Server Express on the same Windows machine

`-S .\SQLEXPRESS` works for `sqlcmd` (it connects locally without TCP), but the app's driver
needs TCP, and Express listens on a *dynamic* port by default. Give it a fixed one:

1. SQL Server Configuration Manager (`SQLServerManager16.msc`) → SQL Server Network
   Configuration → Protocols for SQLEXPRESS → **TCP/IP: Enabled = Yes**.
2. TCP/IP → IP Addresses → **IPAll**: clear *TCP Dynamic Ports*, set *TCP Port* = `1433`
   (or another free port).
3. `Restart-Service 'MSSQL$SQLEXPRESS'`, then `Test-NetConnection localhost -Port 1433` must
   report `TcpTestSucceeded : True`.

SQL logins must be allowed (Server Properties → Security → "SQL Server and Windows
Authentication mode"). Avoid `;` and `"` in the app's password, or the connection string needs
escaping.

## Every release

`npm run db:migrate` (it applies only what this database has not recorded), **before** starting
the new build.

## Housekeeping

Schedule daily (safe to run any time):

```bash
sqlcmd -S <server> -d DigiDocsOPNext -E -b -i database/maintenance/purge_expired.sql
```

## Test installation: test users and sample data (never where real people sign in)

`database/seed/test-users.json` holds the suite's **test team** (Sameer Bidi LFZ Admin, Shaheem
Shaikh NEPZA, Ismail Chaudhary Enterprise of Lekki Port, Khushiyal Vishwakarma Enterprise of
Insignia, at `@edgeaxis.in`) and DigiDocs's own extras (`digidocs.nis`, `digidocs.account`,
`digidocs.waiting` at `@oneportal.test`). `database/seed/sample-data.json` holds 16 sample imports
(SAMPLE-0001…0016): every status, for both enterprises (hub CHILD-APP-GUIDE.md §5.8, §5.10).

```bash
# 0. this .env.local (and the hub's, with the same domains):
#      TEST_USER_EMAIL_DOMAINS="oneportal.test,edgeaxis.in"
#      ALLOW_SAMPLE_DATA=true
# 1. here
npm run db:migrate
npm run db:seed          # the test users with their roles, then the sample imports; safe to repeat
# 2. in the OnePortal folder (after DigiDocs is registered there), with TEST_USER_PASSWORD set:
npm run db:seed          # the team, with access to DigiDocs
npm run test-users:seed -- --file <this repository>/database/seed/test-users.json --app <DigiDocs's App ID in that hub>
                         # DigiDocs's extras (NIS, Account, waiting), which only DigiDocs has
```

They then sign in to OnePortal with their address and the hub's `TEST_USER_PASSWORD`.
`npm run test-users:seed` here loads only the people. Sample imports have no uploaded files.

To start a test installation over: `npm run data:clear` (needs `ALLOW_DATA_CLEAR=true`; lists the
parts; deletes only with `--confirm DigiDocsOPNext`), then `npm run db:seed`.

## Writing a new migration

- Name it `NNNN_what_it_does.sql` with the next number (four digits, lower-case words joined by `_`;
  `npm test` refuses any other name, and a number used twice).
- Keep the file pure ASCII (a unit check enforces it from 0006 on): write any other character as
  `NCHAR(code)`, e.g. `N'S' + NCHAR(227) + N'o Paulo'`.
- Copy the header and the `schema_migrations` guard from `0001_initial.sql`; change the `migration_id`
  (`npm test` checks that each file records its own number).
- Never edit a migration that has been applied anywhere — add a new one.
- Follow the data conventions in `docs/ARCHITECTURE.md` §2 (GUID ids, `DATETIMEOFFSET`,
  lower-case `snake_case`, no name that SQL Server reserves or SSMS highlights — not even the
  singular of a plural table name). `npm test` fails on such a name (`tests/unit/sql-names.test.ts`).
- Give every new table a part in `src/features/maintenance/clear-parts.ts`, or add it to one.

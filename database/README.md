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

2. **Apply the migrations, in order**, with an account that can create tables:

   ```bash
   sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0001_initial.sql
   sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0002_access.sql
   sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0003_enterprises.sql
   sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0004_reference_lists.sql
   sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0005_hse_codes.sql
   sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0006_fix_special_characters.sql
   sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0007_imports_exports.sql
   ```

   **Always pass `-f 65001`**: the files are UTF-8, and without it sqlcmd reads them in the
   Windows code page and stores accented characters wrongly (it happened to 0004–0005; 0006
   repairs it). In SSMS, open the file and Execute: SSMS reads UTF-8 correctly.

   Each file is transactional and records itself in `dbo.schema_migrations`; running it twice
   does nothing the second time.

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

Run any migration file newer than the last applied one (see `SELECT * FROM dbo.schema_migrations`),
**before** starting the new build.

## Housekeeping

Schedule daily (safe to run any time):

```bash
sqlcmd -S <server> -d DigiDocsOPNext -E -b -i database/maintenance/purge_expired.sql
```

## Test users (test installations only)

`database/seed/test-users.json` lists DigiDocs's test users (hub CHILD-APP-GUIDE.md §5.8). With the
migrations applied:

```bash
# 1. here
npm run test-users:seed
# 2. in the OnePortal folder, with TEST_USER_PASSWORD set in its .env.local
npm run test-users:seed -- --file D:/Khushiyal/next-digidocs/database/seed/test-users.json --app <DigiDocs's App ID in that hub>
```

They then sign in to OnePortal with their address and the hub's `TEST_USER_PASSWORD`. To start a
test installation over: `npm run data:clear` (needs `ALLOW_DATA_CLEAR=true`; deletes only with
`--confirm DigiDocsOPNext`). **Never on an installation real people use.**

## Writing a new migration

- Name it `NNNN_what_it_does.sql` with the next number.
- Keep the file pure ASCII (a unit check enforces it from 0006 on): write any other character as
  `NCHAR(code)`, e.g. `N'S' + NCHAR(227) + N'o Paulo'`.
- Copy the header and the `schema_migrations` guard from `0001_initial.sql`; change the `migration_id`.
- Never edit a migration that has been applied anywhere — add a new one.
- Follow the data conventions in `docs/ARCHITECTURE.md` §2 (GUID ids, `DATETIMEOFFSET`,
  lower-case `snake_case`, no name that SQL Server reserves or SSMS highlights — not even the
  singular of a plural table name). `npm test` fails on such a name (`tests/unit/sql-names.test.ts`).
- Give every new table a part in `src/features/maintenance/clear-parts.ts`, or add it to one.

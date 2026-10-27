# DigiDocs

The Lagos Free Zone's customs import/export workflow, as an application in the OnePortal suite
(suite kit v8). People open it from the OnePortal launcher and arrive signed in; it has no login
page and no passwords. Rebuilt module by module from the old ASP.NET MVC DigiDocs.

Start with [docs/CODEBASE-GUIDE.md](docs/CODEBASE-GUIDE.md) (where things live, how to run it),
then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/PROGRESS.md](docs/PROGRESS.md).

## Running it on a development machine

1. Create the database once (`database/setup/create_database.sql`, see
   [database/README.md](database/README.md)).
2. `.env.local` from `.env.example`: connection string, the App ID and secret from OnePortal
   (Administration → Applications), `PORT=3008` with `APP_URL=http://localhost:3008`.
3. `npm ci`, then `npm run db:migrate`.
4. **F5** in VS Code, or `npm run dev`. Open DigiDocs from the OnePortal launcher.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:ui`.

## Database commands (the same in every suite application)

| Command | What it does | Where |
|---|---|---|
| `npm run db:migrate` | Applies the migrations this database has not recorded, in order (`-- --status` only lists them) | Everywhere, before starting a new build |
| `npm run db:seed` | The test users, then 16 sample imports. Needs `ALLOW_SAMPLE_DATA=true` and `TEST_USER_EMAIL_DOMAINS="oneportal.test,edgeaxis.in"` | Test installations only |
| `npm run test-users:seed` | Only the test users | Test installations only |
| `npm run data:clear` | Empties chosen parts of the database (needs `ALLOW_DATA_CLEAR=true` and `--confirm DigiDocsOPNext`) | Test installations only |
| `npm run admin:grant -- --email <address>` | Makes someone who has opened DigiDocs an LFZ Admin (the first one) | Everywhere |

## On a server (PM2)

```bash
npm install -g pm2      # once per server
npm ci
npm run db:migrate
npm run pm2:start       # build, then start (process "digidocs", port from .env.local)
npm run pm2:reload      # after each deploy: build, then reload without downtime
npm run pm2:logs        # pm2:status, pm2:stop, pm2:delete
```

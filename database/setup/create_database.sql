/*
  One-time setup, run by a DBA with sysadmin rights (e.g. `sqlcmd -S <server> -E -i ...`).

  Creates the DigiDocsOPNext database and a SQL login the web app connects with. The app login gets
  read/write on data only — no DDL. Schema changes are applied by a person running the files in
  database/migrations/ with their own (DDL-capable) account.

  BEFORE RUNNING: replace the password placeholder below with a strong generated password, and
  put the same value in the app's DATABASE_CONNECTION_STRING. Do not commit the real password.
*/
SET NOCOUNT ON;

IF DB_ID(N'DigiDocsOPNext') IS NULL
    CREATE DATABASE DigiDocsOPNext;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'digidocs_app')
    CREATE LOGIN digidocs_app
        WITH PASSWORD = N'<<REPLACE WITH A STRONG PASSWORD>>',
             CHECK_POLICY = ON,
             DEFAULT_DATABASE = DigiDocsOPNext;
GO

USE DigiDocsOPNext;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'digidocs_app')
    CREATE USER digidocs_app FOR LOGIN digidocs_app;
GO

ALTER ROLE db_datareader ADD MEMBER digidocs_app;
ALTER ROLE db_datawriter ADD MEMBER digidocs_app;
GO

PRINT 'DigiDocsOPNext database and digidocs_app login are ready. Next: run database/migrations/*.sql in order.';

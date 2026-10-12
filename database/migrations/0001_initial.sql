/*
  0001_initial — DigiDocs schema: the application's own users and sessions.

  Run against the DigiDocsOPNext database (see database/README.md):
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -i database/migrations/0001_initial.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
  Never edit this file after it has been applied anywhere; add 0002_... instead.

  Conventions (docs/ARCHITECTURE.md §2):
  - Names are lower-case snake_case; tables are plural. No name — nor the singular of a plural
    table name — is a word SSMS highlights: SQL Server/ODBC/future keywords, SSMS keywords, or
    built-in function names (pinned by tests/unit/sql-names.test.ts).
  - Ids are UNIQUEIDENTIFIER. They are the only identifiers, and safe to expose.
  - Instants are DATETIMEOFFSET and are computed by SQL Server (SYSDATETIMEOFFSET()),
    never by the web server's clock.
  - Secrets (session tokens) are stored only as SHA-256 hex hashes. DigiDocs stores no
    passwords: people sign in through OnePortal.
*/
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.schema_migrations', N'U') IS NULL
    CREATE TABLE dbo.schema_migrations (
        migration_id  VARCHAR(20)    NOT NULL CONSTRAINT pk_schema_migrations PRIMARY KEY,
        applied_at    DATETIMEOFFSET NOT NULL CONSTRAINT df_schema_migrations_applied_at DEFAULT SYSDATETIMEOFFSET()
    );

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0001')
BEGIN
    PRINT '0001_initial is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

-- People who have signed in to DigiDocs through OnePortal. Created at their first sign-in.
CREATE TABLE dbo.user_accounts (
    id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_user_accounts_id DEFAULT NEWSEQUENTIALID(),
    hub_user_id  UNIQUEIDENTIFIER NOT NULL,   -- the person's permanent OnePortal id
    email        NVARCHAR(254)    NOT NULL,   -- copied from the hub at every sign-in
    full_name    NVARCHAR(200)    NOT NULL,   -- copied from the hub at every sign-in
    is_active    BIT              NOT NULL CONSTRAINT df_user_accounts_is_active DEFAULT 1,
    created_at   DATETIMEOFFSET   NOT NULL CONSTRAINT df_user_accounts_created_at DEFAULT SYSDATETIMEOFFSET(),
    updated_at   DATETIMEOFFSET   NOT NULL CONSTRAINT df_user_accounts_updated_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT pk_user_accounts PRIMARY KEY (id),
    CONSTRAINT uq_user_accounts_hub_user_id UNIQUE (hub_user_id)
);

-- Signed-in browser sessions. The cookie holds a random token; only its hash is stored.
CREATE TABLE dbo.user_sessions (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_user_sessions_id DEFAULT NEWSEQUENTIALID(),
    account_id    UNIQUEIDENTIFIER NOT NULL,
    token_hash    CHAR(64)         NOT NULL,
    ip_address    VARCHAR(45)      NULL,
    user_agent    NVARCHAR(400)    NULL,
    created_at    DATETIMEOFFSET   NOT NULL CONSTRAINT df_user_sessions_created_at DEFAULT SYSDATETIMEOFFSET(),
    last_seen_at  DATETIMEOFFSET   NOT NULL CONSTRAINT df_user_sessions_last_seen_at DEFAULT SYSDATETIMEOFFSET(),
    expires_at    DATETIMEOFFSET   NOT NULL,
    revoked_at    DATETIMEOFFSET   NULL,
    CONSTRAINT pk_user_sessions PRIMARY KEY (id),
    CONSTRAINT uq_user_sessions_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_user_sessions_account FOREIGN KEY (account_id) REFERENCES dbo.user_accounts (id) ON DELETE CASCADE
);
CREATE INDEX ix_user_sessions_account ON dbo.user_sessions (account_id, expires_at);

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0001');

COMMIT TRANSACTION;
PRINT '0001_initial applied.';

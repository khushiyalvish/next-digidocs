/*
  0002_access — who may do what in DigiDocs: organisations (the free-zone enterprises), each
  person's role and organisation, and the audit log of administrators' changes.

  Run against the DigiDocsOPNext database (see database/README.md), after 0001:
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -i database/migrations/0002_access.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
  Never edit this file after it has been applied anywhere; add 0004_... instead.

  Roles are a fixed list in code (src/features/access/roles.ts); the CHECK below must name the
  same keys. Only an Enterprise user belongs to an organisation: LFZ, NEPZA, NIS and Account
  staff see every organisation's records (old DigiDocs: UserDetails.OrganizationID was the zone
  operator for all of them).
*/
-- sqlcmd starts with QUOTED_IDENTIFIER OFF; filtered indexes need it ON (SSMS sets it by default).
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0002')
BEGIN
    PRINT '0002_access is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

-- The free-zone enterprises that submit imports and exports (old DigiDocs: M_Organization).
CREATE TABLE dbo.organisations (
    id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_organisations_id DEFAULT NEWSEQUENTIALID(),
    company_name        NVARCHAR(300)    NOT NULL,
    short_code          NVARCHAR(20)     NOT NULL,   -- e.g. "LPLELTD"; shown in lists and references
    orion_code          NVARCHAR(100)    NULL,       -- the company's code in Orion (revenue)
    registration_number NVARCHAR(100)    NULL,
    registration_date   DATE             NULL,
    licence_number      NVARCHAR(100)    NULL,       -- operating licence
    licence_expires_on  DATE             NULL,
    legacy_id           INT              NULL,       -- M_Organization.OrganizationID in old DigiDocs, for data mapping
    is_active           BIT              NOT NULL CONSTRAINT df_organisations_is_active DEFAULT 1,
    created_at          DATETIMEOFFSET   NOT NULL CONSTRAINT df_organisations_created_at DEFAULT SYSDATETIMEOFFSET(),
    updated_at          DATETIMEOFFSET   NOT NULL CONSTRAINT df_organisations_updated_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT pk_organisations PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ux_organisations_legacy_id ON dbo.organisations (legacy_id) WHERE legacy_id IS NOT NULL;

-- A person's role in DigiDocs (NULL: signed in, waiting for an administrator) and, for an
-- Enterprise user, their organisation. Separate statements so the naming check sees each column.
ALTER TABLE dbo.user_accounts ADD role_key VARCHAR(20) NULL;
ALTER TABLE dbo.user_accounts ADD organisation_id UNIQUEIDENTIFIER NULL;
ALTER TABLE dbo.user_accounts ADD mobile_number VARCHAR(30) NULL;

-- Added with EXEC because SQL Server compiles a batch before the columns above exist.
EXEC (N'
ALTER TABLE dbo.user_accounts ADD
    CONSTRAINT fk_user_accounts_organisation FOREIGN KEY (organisation_id) REFERENCES dbo.organisations (id),
    CONSTRAINT ck_user_accounts_role_key CHECK (role_key IN (''lfz_admin'', ''enterprise'', ''nepza'', ''nis'', ''account'')),
    CONSTRAINT ck_user_accounts_organisation CHECK (
        (role_key = ''enterprise'' AND organisation_id IS NOT NULL)
        OR (ISNULL(role_key, '''') <> ''enterprise'' AND organisation_id IS NULL));
CREATE INDEX ix_user_accounts_organisation ON dbo.user_accounts (organisation_id) WHERE organisation_id IS NOT NULL;
');

-- Append-only record of administrators' changes. No foreign keys: the record outlives the rows
-- it mentions, so actor and target are snapshotted as text.
CREATE TABLE dbo.audit_events (
    id                BIGINT IDENTITY(1, 1) NOT NULL,
    occurred_at       DATETIMEOFFSET   NOT NULL CONSTRAINT df_audit_events_occurred_at DEFAULT SYSDATETIMEOFFSET(),
    actor_account_id  UNIQUEIDENTIFIER NULL,
    actor_email       NVARCHAR(254)    NULL,
    event_type        VARCHAR(50)      NOT NULL,
    target_label      NVARCHAR(300)    NULL,
    ip_address        VARCHAR(45)      NULL,
    detail            NVARCHAR(1000)   NULL,
    CONSTRAINT pk_audit_events PRIMARY KEY (id)
);
CREATE INDEX ix_audit_events_occurred ON dbo.audit_events (occurred_at DESC);

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0002');

COMMIT TRANSACTION;
PRINT '0002_access applied.';

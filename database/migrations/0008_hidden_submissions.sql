/*
  0008_hidden_submissions - "Delete" on the import and export lists hides a record instead of
  removing it, as old DigiDocs did (ImpExp_D / Exp_D set IsActive = 0). An Enterprise user may
  delete their organisation's drafts and the imports/exports LFTZ rejected (decision log
  2026-10-14). A hidden record keeps all its data; the lists and the dashboard leave it out.

  Adds to dbo.imports and dbo.exports:
    deleted_at             when it was hidden; NULL while it is shown
    deleted_by_account_id  who hid it (NULL again if that person is removed by data:clear)

  The unique tracking number now applies only to shown records, so a hidden draft does not block
  its tracking number.

  Run against DigiDocsOPNext after 0007 (see database/README.md):
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0008_hidden_submissions.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
  Never edit this file after it has been applied anywhere; add a new one instead.
*/
-- sqlcmd starts with QUOTED_IDENTIFIER OFF; filtered indexes need it ON (SSMS sets it by default).
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0008')
BEGIN
    PRINT '0008_hidden_submissions is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

ALTER TABLE dbo.imports ADD deleted_at DATETIMEOFFSET NULL;
ALTER TABLE dbo.imports ADD deleted_by_account_id UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_imports_deleted_by REFERENCES dbo.user_accounts (id);

ALTER TABLE dbo.exports ADD deleted_at DATETIMEOFFSET NULL;
ALTER TABLE dbo.exports ADD deleted_by_account_id UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_exports_deleted_by REFERENCES dbo.user_accounts (id);

-- A tracking number is unique among the records still shown. These indexes name the columns added
-- above, so they run as their own batches (EXEC): this batch was compiled before the columns existed.
DROP INDEX ux_imports_tracking_number ON dbo.imports;
EXEC (N'CREATE UNIQUE INDEX ux_imports_tracking_number ON dbo.imports (tracking_number)
        WHERE tracking_number IS NOT NULL AND deleted_at IS NULL;');

DROP INDEX ux_exports_tracking_number ON dbo.exports;
EXEC (N'CREATE UNIQUE INDEX ux_exports_tracking_number ON dbo.exports (tracking_number)
        WHERE tracking_number IS NOT NULL AND deleted_at IS NULL;');

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0008');

COMMIT TRANSACTION;
PRINT '0008_hidden_submissions applied.';

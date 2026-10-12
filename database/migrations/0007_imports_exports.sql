/*
  0007_imports_exports - the imports and exports enterprises submit (modules 4 and 5), with what
  their lists and the workflow need: the enterprise, who created it, the transaction type, the
  tracking number, the workflow status and its reason, and when it was created, last saved and
  last submitted. The form's own fields (key information, items, containers, invoices,
  documents) come with Add Import and Add Export, in their own migrations (decision log
  2026-10-08).

  Old DigiDocs: T_ImpExp (imports) and Map_ExportKeyInfo (exports), with M_WorkFlowStatus ids
  2-13. The statuses are a fixed list in code (src/features/workflow/statuses.ts); the CHECKs
  below must name the same keys. Old ids 10 and 11 (both "Process Completed") are one status
  here. Nothing is copied from the old tables: they hold transactions, not reference data.

  Imports and exports are separate: each has its own table, and its mapping tables (items,
  containers, invoices, documents) will point only at it. transaction_direction is fixed per
  table and is part of the foreign key to transaction_types, so the database refuses an import
  with an export type and the other way round.

  Run against DigiDocsOPNext after 0006 (see database/README.md):
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0007_imports_exports.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
  Never edit this file after it has been applied anywhere; add a new one instead.
*/
-- sqlcmd starts with QUOTED_IDENTIFIER OFF; filtered indexes need it ON (SSMS sets it by default).
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0007')
BEGIN
    PRINT '0007_imports_exports is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

-- What the two foreign keys below point at: a transaction type together with its direction.
CREATE UNIQUE INDEX ux_transaction_types_id_direction ON dbo.transaction_types (id, direction);

-- An import (old DigiDocs: T_ImpExp). Its transaction type is always an import type.
CREATE TABLE dbo.imports (
    id                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_imports_id DEFAULT NEWSEQUENTIALID(),
    organisation_id       UNIQUEIDENTIFIER NOT NULL,   -- the enterprise it belongs to
    created_by_account_id UNIQUEIDENTIFIER NOT NULL,   -- the Enterprise user who created it
    transaction_type_id   UNIQUEIDENTIFIER NOT NULL,   -- "Particular" in old DigiDocs
    transaction_direction VARCHAR(10)      NOT NULL CONSTRAINT df_imports_transaction_direction DEFAULT 'import',
    tracking_number       NVARCHAR(100)    NULL,
    status_key            VARCHAR(30)      NOT NULL CONSTRAINT df_imports_status_key DEFAULT 'draft',
    status_reason         NVARCHAR(2500)   NULL,       -- the reason given with the latest rejection
    form_saved_at         DATETIMEOFFSET   NULL,       -- last time the enterprise saved the form ("Form Modified Date")
    submitted_at          DATETIMEOFFSET   NULL,       -- last final submission ("Final Submit Date")
    created_at            DATETIMEOFFSET   NOT NULL CONSTRAINT df_imports_created_at DEFAULT SYSDATETIMEOFFSET(),
    updated_at            DATETIMEOFFSET   NOT NULL CONSTRAINT df_imports_updated_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT pk_imports PRIMARY KEY (id),
    CONSTRAINT fk_imports_organisation FOREIGN KEY (organisation_id) REFERENCES dbo.organisations (id),
    CONSTRAINT fk_imports_created_by FOREIGN KEY (created_by_account_id) REFERENCES dbo.user_accounts (id),
    CONSTRAINT ck_imports_transaction_direction CHECK (transaction_direction = 'import'),
    CONSTRAINT fk_imports_transaction_type FOREIGN KEY (transaction_type_id, transaction_direction)
        REFERENCES dbo.transaction_types (id, direction),
    CONSTRAINT ck_imports_status_key CHECK (status_key IN ('draft', 'enterprise_submitted', 'submitted', 'lfz_saved',
        'lfz_approved', 'lfz_rejected', 'nepza_saved', 'nepza_approved', 'nepza_rejected', 'nepza_letter_rejected', 'completed'))
);
CREATE INDEX ix_imports_organisation ON dbo.imports (organisation_id, created_at DESC);
CREATE INDEX ix_imports_status ON dbo.imports (status_key, created_at DESC);
CREATE UNIQUE INDEX ux_imports_tracking_number ON dbo.imports (tracking_number) WHERE tracking_number IS NOT NULL;

-- An export (old DigiDocs: Map_ExportKeyInfo). Its transaction type is always an export type.
CREATE TABLE dbo.exports (
    id                    UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_exports_id DEFAULT NEWSEQUENTIALID(),
    organisation_id       UNIQUEIDENTIFIER NOT NULL,
    created_by_account_id UNIQUEIDENTIFIER NOT NULL,
    transaction_type_id   UNIQUEIDENTIFIER NOT NULL,
    transaction_direction VARCHAR(10)      NOT NULL CONSTRAINT df_exports_transaction_direction DEFAULT 'export',
    tracking_number       NVARCHAR(100)    NULL,
    status_key            VARCHAR(30)      NOT NULL CONSTRAINT df_exports_status_key DEFAULT 'draft',
    status_reason         NVARCHAR(2500)   NULL,
    form_saved_at         DATETIMEOFFSET   NULL,
    submitted_at          DATETIMEOFFSET   NULL,
    created_at            DATETIMEOFFSET   NOT NULL CONSTRAINT df_exports_created_at DEFAULT SYSDATETIMEOFFSET(),
    updated_at            DATETIMEOFFSET   NOT NULL CONSTRAINT df_exports_updated_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT pk_exports PRIMARY KEY (id),
    CONSTRAINT fk_exports_organisation FOREIGN KEY (organisation_id) REFERENCES dbo.organisations (id),
    CONSTRAINT fk_exports_created_by FOREIGN KEY (created_by_account_id) REFERENCES dbo.user_accounts (id),
    CONSTRAINT ck_exports_transaction_direction CHECK (transaction_direction = 'export'),
    CONSTRAINT fk_exports_transaction_type FOREIGN KEY (transaction_type_id, transaction_direction)
        REFERENCES dbo.transaction_types (id, direction),
    CONSTRAINT ck_exports_status_key CHECK (status_key IN ('draft', 'enterprise_submitted', 'submitted', 'lfz_saved',
        'lfz_approved', 'lfz_rejected', 'nepza_saved', 'nepza_approved', 'nepza_rejected', 'nepza_letter_rejected', 'completed'))
);
CREATE INDEX ix_exports_organisation ON dbo.exports (organisation_id, created_at DESC);
CREATE INDEX ix_exports_status ON dbo.exports (status_key, created_at DESC);
CREATE UNIQUE INDEX ux_exports_tracking_number ON dbo.exports (tracking_number) WHERE tracking_number IS NOT NULL;

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0007');

COMMIT TRANSACTION;
PRINT '0007_imports_exports applied.';

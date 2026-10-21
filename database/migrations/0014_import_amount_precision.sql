/*
  0014_import_amount_precision - FOB values and the calculated item values kept at 4 decimals, as
  old Import.js calculated and submitted them ("internal calculations: 4 decimals; database
  submission: 4 decimals"; decision log 2026-10-19). 0009 and 0013 gave them 2. Shown with 2.

  Run against DigiDocsOPNext after 0013 (see database/README.md):
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0014_import_amount_precision.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
  Never edit this file after it has been applied anywhere; add a new one instead.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0014')
BEGIN
    PRINT '0014_import_amount_precision is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

ALTER TABLE dbo.import_invoices ALTER COLUMN fob_value DECIMAL(22, 4) NULL;
ALTER TABLE dbo.import_items ALTER COLUMN fob_value DECIMAL(22, 4) NULL;
ALTER TABLE dbo.import_items ALTER COLUMN allocated_freight DECIMAL(22, 4) NULL;
ALTER TABLE dbo.import_items ALTER COLUMN allocated_insurance DECIMAL(22, 4) NULL;
ALTER TABLE dbo.import_items ALTER COLUMN cif_value DECIMAL(22, 4) NULL;
ALTER TABLE dbo.import_items ALTER COLUMN ciss_value DECIMAL(22, 4) NULL;
ALTER TABLE dbo.import_items ALTER COLUMN etls_value DECIMAL(22, 4) NULL;

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0014');

COMMIT TRANSACTION;
PRINT '0014_import_amount_precision applied.';

/*
  0013_import_item_values - the columns of an import item that old Map_ImpExpItem had and 0009
  left out: the item's calculated values and the HSE code's rates as they were when it was saved
  (decision log 2026-10-19).

    allocated_freight, allocated_insurance   old Freight, Insurance (the item's share)
    cif_value                                 CIF value (FOB + freight + insurance)
    ciss_value, etls_value                    old CISS (1% of FOB), ETLS (0.5% of CIF)
    import_duty_value, levy_value,            old IDValue, LVYValue,
    excise_value, vat_value                   EXCValue, VATValue
    import_duty_rate, levy_rate,              the HSE code's rates, copied at each save, so a later
    excise_rate, vat_rate                     tariff change does not change a submitted import

  The rates are filled from 0013 on; the values by the calculation step (until then NULL).

  Run against DigiDocsOPNext after 0012 (see database/README.md):
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0013_import_item_values.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
  Never edit this file after it has been applied anywhere; add a new one instead.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0013')
BEGIN
    PRINT '0013_import_item_values is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

ALTER TABLE dbo.import_items ADD allocated_freight DECIMAL(22, 2) NULL;
ALTER TABLE dbo.import_items ADD allocated_insurance DECIMAL(22, 2) NULL;
ALTER TABLE dbo.import_items ADD cif_value DECIMAL(22, 2) NULL;
ALTER TABLE dbo.import_items ADD ciss_value DECIMAL(22, 2) NULL;
ALTER TABLE dbo.import_items ADD etls_value DECIMAL(22, 2) NULL;
ALTER TABLE dbo.import_items ADD import_duty_rate DECIMAL(5, 2) NULL;
ALTER TABLE dbo.import_items ADD levy_rate DECIMAL(5, 2) NULL;
ALTER TABLE dbo.import_items ADD excise_rate DECIMAL(5, 2) NULL;
ALTER TABLE dbo.import_items ADD vat_rate DECIMAL(5, 2) NULL;
ALTER TABLE dbo.import_items ADD import_duty_value DECIMAL(22, 2) NULL;
ALTER TABLE dbo.import_items ADD levy_value DECIMAL(22, 2) NULL;
ALTER TABLE dbo.import_items ADD excise_value DECIMAL(22, 2) NULL;
ALTER TABLE dbo.import_items ADD vat_value DECIMAL(22, 2) NULL;

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0013');

COMMIT TRANSACTION;
PRINT '0013_import_item_values applied.';

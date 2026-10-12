/*
  0006_fix_special_characters - rewrites the 21 reference values that contain a character
  outside ASCII (accented names, m2, curly quotes). 0004 and 0005 were applied with sqlcmd without
  -f 65001, which read the UTF-8 files as Windows-1252 and stored each such character as two
  (an o-umlaut became "A-tilde + pilcrow"). Every character above ASCII is written as NCHAR(code), so this file
  is pure ASCII and loads correctly however it is run. Values come from the old DigiDocs dump, as
  in 0003-0005 (0003 is included for completeness; it had no such characters).

  Run against DigiDocsOPNext after 0005:
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0006_fix_special_characters.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0006')
BEGIN
    PRINT '0006_fix_special_characters is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

UPDATE dbo.countries SET country_name = N'S' + NCHAR(227) + N'o Tom' + NCHAR(233) + N' and Pr' + NCHAR(237) + N'ncipe' WHERE legacy_id = 174;
UPDATE dbo.currencies SET currency_name = N'Mongolian t' + NCHAR(246) + N'gr' + NCHAR(246) + N'g' WHERE iso_code = 'MNT';
UPDATE dbo.ports SET port_name = N'GRU - S' + NCHAR(227) + N'o Paulo Guarulhos International' WHERE legacy_id = 136;
UPDATE dbo.ports SET port_name = N'DUS - D' + NCHAR(252) + N'sseldorf Airport' WHERE legacy_id = 159;
UPDATE dbo.ports SET port_name = N'LYS - Lyon Saint-Exup' + NCHAR(233) + N'ry Airport' WHERE legacy_id = 166;
UPDATE dbo.ports SET port_name = N'AGP - M' + NCHAR(225) + N'laga Airport' WHERE legacy_id = 176;
UPDATE dbo.ports SET port_name = N'SAW - Sabiha G' + NCHAR(246) + N'k' + NCHAR(231) + N'en International' WHERE legacy_id = 188;
UPDATE dbo.ports SET port_name = N'GIG - Rio de Janeiro Gale' + NCHAR(227) + N'o International' WHERE legacy_id = 237;
UPDATE dbo.ports SET port_name = N'BSB - Bras' + NCHAR(237) + N'lia International' WHERE legacy_id = 238;
UPDATE dbo.ports SET port_name = N'CUN - Canc' + NCHAR(250) + N'n International' WHERE legacy_id = 242;
UPDATE dbo.ports SET port_name = N'COR - C' + NCHAR(243) + N'rdoba Airport' WHERE legacy_id = 250;
UPDATE dbo.ports SET port_name = N'SCL - Comodoro Arturo Merino Ben' + NCHAR(237) + N'tez International' WHERE legacy_id = 252;
UPDATE dbo.ports SET port_name = N'MDE - Jos' + NCHAR(233) + N' Mar' + NCHAR(237) + N'a C' + NCHAR(243) + N'rdova International' WHERE legacy_id = 254;
UPDATE dbo.ports SET port_name = N'CTG - Rafael N' + NCHAR(250) + NCHAR(241) + N'ez International' WHERE legacy_id = 255;
UPDATE dbo.ports SET port_name = N'CLO - Alfonso Bonilla Arag' + NCHAR(243) + N'n International' WHERE legacy_id = 256;
UPDATE dbo.ports SET port_name = N'RBA - Rabat-Sal' + NCHAR(233) + N' Airport' WHERE legacy_id = 265;
UPDATE dbo.document_types SET document_name = N'Manufacturer' + NCHAR(8217) + N's Certificate of Production / Analysis' WHERE legacy_id = 41;
UPDATE dbo.hse_codes SET goods_description = N'Microbial fats and oils and their fractions' + NCHAR(8221) + N'.' WHERE legacy_id = 859;
UPDATE dbo.hse_codes SET goods_description = N'Beverages containing high doses of caffeine of the kind ' + NCHAR(8220) + N'Energy drinks' + NCHAR(8221) WHERE legacy_id = 1092;
UPDATE dbo.hse_codes SET goods_description = N'Dodge' + NCHAR(8217) + N'em cars' WHERE legacy_id = 6622;
UPDATE dbo.hse_codes SET goods_description = N'Weighing more than 150 g/m' + NCHAR(178) WHERE legacy_id = 6787;

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0006');

COMMIT TRANSACTION;
PRINT '0006_fix_special_characters applied: 21 values rewritten.';

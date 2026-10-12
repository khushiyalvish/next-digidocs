/*
  0003_enterprises — the free-zone enterprises from old DigiDocs (M_Organization, dump of
  2026-03-09), as reference data. Organisation 1 (Lagos Free Zone Company, the zone operator) is
  not an enterprise and is left out: its staff have the LFZ Admin, NEPZA, NIS or Account role and
  no organisation (0002). Values are copied as they were, including the duplicates the old data
  had (CNC Engineering: legacy 12 and 41; Free Zone Utilities: 16 and 92) and the placeholder
  registration/licence numbers of the 2025 entries; administrators correct them on the
  Organisations screen.

  Run against DigiDocsOPNext after 0002:
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -i database/migrations/0003_enterprises.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
*/
-- sqlcmd starts with QUOTED_IDENTIFIER OFF; filtered indexes need it ON (SSMS sets it by default).
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0003')
BEGIN
    PRINT '0003_enterprises is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

INSERT INTO dbo.organisations
    (legacy_id, company_name, short_code, orion_code, registration_number, registration_date, licence_number, licence_expires_on, is_active)
VALUES
    (2, N'Lekki Port LFTZ Enterprise Limited', N'LPLELTD', N'TDLC-LPLELTD', N'RCI/0112', '2007-08-17', N'NEPZA/OP/L:0613', '2021-12-31', 1),
    (3, N'Insignia Print Technologies LFTZ Enterprise', N'INS', N'TDLC-INS', N'RCI/0093', '2007-08-18', N'NEPZA/OP/L:0614', '2021-12-31', 1),
    (4, N'Raffles Oil LFTZ Enterprise', N'ROLE', N'TDLC-ROLE', N'RCI/0074', '2007-08-19', N'OP.LIC No. 0530/003/005', '2021-12-31', 1),
    (5, N'KT LFTZ Enterprise', N'KTLE', N'TDLC-KTLE', N'RCI/0055', '2007-08-20', N'OP.LIC No. 0530/003/006', '2021-12-31', 1),
    (6, N'TG ARLA DAIRY PRODUCTS LFTZ ENTERPRISE', N'TGF', N'TDLC-TGF', N'RCI/0036', '2007-08-21', N'OP.LIC No. 0530/003/007', '2021-12-31', 1),
    (7, N'Tolaram Africa LFTZ Enterprise', N'TAL', N'TDLC-MLE', N'RCI/0017', '2007-08-22', N'OP.LIC No. 0530/003/008', '2021-12-31', 1),
    (8, N'China Harbour Engineering LFTZ Enterprise', N'CHELE', N'TDLC-CHELE', N'RCI/0002', '2007-08-23', N'OP.LIC No. 0530/003/009', '2021-12-31', 1),
    (9, N'LOUIS BERGER', N'LOUIS B', N'TDLC-LOUIS B', N'RCI/0021', '2007-08-24', N'OP.LIC No. 0530/003/010', '2021-12-31', 1),
    (10, N'Sana Building System LFTZ Enterprise', N'SANA', N'TDLC-SANA', N'RCI/0040', '2007-08-25', N'OP.LIC No. 0530/003/011', '2021-12-31', 1),
    (12, N'CNC ENGINEERING LFTZ ENTERPRISE', N'CNC', N'TDLC-CNC', N'RCI/0078', '2007-08-27', N'OP.LIC No. 0530/003/013', '2021-12-31', 1),
    (13, N'COLGATE TOLARAM LFTZ ENTERPRISE', N'CTLE', N'TDLC-CTLE', N'RCI/0097', '2007-08-28', N'OP.LIC No. 0530/003/014', '2021-12-31', 1),
    (14, N'BASF Operations LFTZ Enterprise', N'BASF', N'TDLC-BASF', N'RCI/0116', '2007-08-29', N'OP.LIC No. 0530/003/015', '2021-12-31', 1),
    (15, N'Energy Distribution LFTZ Enterprise', N'EDLE', N'TDLC-EDLE', N'RCI/0135', '2007-08-30', N'OP.LIC No. 0530/003/016', '2021-12-31', 1),
    (16, N'Free Zone Utilities LFTZ Enterprise', N'FZU', N'TDLC-FZULFTZ', N'RCI/0154', '2007-08-31', N'OP.LIC No. 0530/003/017', '2021-12-31', 1),
    (17, N'Bollore Transport & Logistics LFTZ Enterprise', N'BALLE', N'TDLC-BALLE', N'RCI/0173', '2007-09-01', N'OP.LIC No. 0530/003/018', '2021-12-31', 1),
    (18, N'Tarka Minerals LFTZ Enterprise', N'TMLE', N'TDLC-TMLE', N'RCI/0192', '2007-09-02', N'OP.LIC No. 0530/003/019', '2021-12-31', 1),
    (25, N'SANA GLOBAL PROJECTS LFZ ENTERPRISE', N'SGPLE', N'TDLC-SGPLE', N'RCI/1196', '2013-12-03', N'OP.LIC No. 0530/003/026', '2021-12-31', 1),
    (41, N'CNC ENGINEERING LFTZ ENTERPRISE', N'CNC', N'TDLC-CNC', N'RCI/1204', '2013-12-19', N'OP.LIC No. 0530/003/042', '2021-12-31', 1),
    (66, N'TIL MOTOR-HUB NIGERIA LFZ ENTERPRISE', N'TILM', N'TDLC-TILM', N'RCI/1217', '2014-01-14', N'OP.LIC No. 0530/003/068', '2021-12-31', 1),
    (78, N'MAIN ONE CABLE COMPANY NIGERIA LFZ ENTERPRISE', N'MOCCNLE', N'TDLC-MOCCNLE', N'RC 1018080', '2014-01-27', N'OP.LIC No. 0530/003/081', '2021-12-31', 1),
    (80, N'Lekki Free Port Terminal LFZ Enterprise', N'LFTLE', N'TDLC-LFTLE', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (81, N'OPTIMERA ENERGY LFZ ENTERPRISE', N'OELE', N'TDCL-OELE', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (82, N'LOGICHEM LFZ ENTERPRISES', N'LLE', N'TDLC-LLE', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (83, N'GREEN PACKAGING LFZ ENTERPRISE', N'GPLE', N'TDLC-GPLE', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (84, N'DREAMHOUSE LFZ ENTERPRISE', N'DHLE', N'TDCL-DHLE', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (85, N'SUPERMARINE FZE', N'SSL', N'TDLC-SF', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (87, N'GUALA CLOSURES WEST AFRICA LFZ ENTERPRISE', N'GCIB', N'TDLC-GCIB', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (88, N'ADM NIGERIA LFZ ENTERPRISE', N'ADMC', N'TDLC-ADMC', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (89, N'NGLKK CONTAINER LOGISTICS LFZE', N'RSCL', N'TDLC-RSCL', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (90, N'Elev-8 Spirit LFZE', N'E8SL', N'TDLC-E8SL', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (91, N'BC FIBER OPTIK SAN.TIC.A.S', N'BFOS', N'TDLC-BFOS', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (92, N'FREE ZONE UTILITIES LFTZ ENTERPRISE', N'FZULFTZ', N'TDLC-FZULFTZ', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (93, N'IRELE ENERGY LFZ ENTERPRISE', N'IRELE', N'IRELE', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (94, N'IGBOYA POWER LFZ ENTERPRISE', N'IGBOYA', N'IGBOYA', N'RC 1018080', '2025-04-08', N'OP.LIC No. 0530/003/081', '2025-04-08', 1),
    (95, N'ASHISH LIFE SCIENCE WEST AFRICA FZE', N'ALSWAF', N'TDLC-ALSWAF', N'RC 1018080', '2025-08-18', N'OP.LIC No. 0530/003/081', '2025-08-18', 1);

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0003');

COMMIT TRANSACTION;
PRINT '0003_enterprises applied: 35 organisations.';

/*
  0009_import_form - the Add Import form (module 4): the key information on dbo.imports, and its
  lines in their own tables: Bill of Lading numbers, invoices, containers and items (decision log
  2026-10-14). Documents and the duty-paid file come in a later migration.

  Old DigiDocs: T_ImpExp (key information), BLNo list, Map_ImpExpInvoice, Map_ImpExpContainar,
  Map_ImpExpItem. Nothing is copied: they hold transactions, not reference data. Every column is
  NULL-able because a draft may be saved with nothing filled in; Submit checks what is required
  (src/features/imports/form.ts). Calculated item values (allocated freight and insurance, CIF,
  CISS, ETLS, duties) are not stored yet: they come with the calculation step.

  Tracking numbers: ORG/PARTICULAR/YYYYMM + 5 digits (old GenerateTrackingNo), the number taken
  from dbo.import_tracking_numbers when the draft is created.

  Run against DigiDocsOPNext after 0008 (see database/README.md):
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0009_import_form.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
  Never edit this file after it has been applied anywhere; add a new one instead.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0009')
BEGIN
    PRINT '0009_import_form is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

-- The running number in a tracking number (old: the T_ImpExp id).
CREATE SEQUENCE dbo.import_tracking_numbers AS INT START WITH 1 INCREMENT BY 1 NO CYCLE;

-- Key information (old T_ImpExp). Which of these a Particular shows comes from the old settings.
ALTER TABLE dbo.imports ADD import_country_id UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_imports_import_country REFERENCES dbo.countries (id);
ALTER TABLE dbo.imports ADD import_state_id UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_imports_import_state REFERENCES dbo.nigerian_states (id);
ALTER TABLE dbo.imports ADD clearing_agent_id UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_imports_clearing_agent REFERENCES dbo.clearing_agents (id);
ALTER TABLE dbo.imports ADD shipping_mode VARCHAR(10) NULL
    CONSTRAINT ck_imports_shipping_mode CHECK (shipping_mode IN ('sea', 'road', 'air'));
ALTER TABLE dbo.imports ADD discharge_port_id UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_imports_discharge_port REFERENCES dbo.ports (id);
ALTER TABLE dbo.imports ADD consignment_currency_id UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_imports_consignment_currency REFERENCES dbo.currencies (id);
ALTER TABLE dbo.imports ADD packing_list_number NVARCHAR(50) NULL;
ALTER TABLE dbo.imports ADD freight_value DECIMAL(22, 2) NULL;
ALTER TABLE dbo.imports ADD insurance_value DECIMAL(22, 2) NULL;
ALTER TABLE dbo.imports ADD shipment_quantity DECIMAL(22, 3) NULL;
ALTER TABLE dbo.imports ADD air_quantity DECIMAL(22, 3) NULL;
ALTER TABLE dbo.imports ADD shipment_unit_id UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_imports_shipment_unit REFERENCES dbo.measurement_units (id);
ALTER TABLE dbo.imports ADD total_cbm DECIMAL(21, 2) NULL;
ALTER TABLE dbo.imports ADD total_tonnes DECIMAL(21, 2) NULL;
ALTER TABLE dbo.imports ADD duty_paid BIT NULL;
ALTER TABLE dbo.imports ADD duty_reference_number NVARCHAR(200) NULL;
ALTER TABLE dbo.imports ADD material_description NVARCHAR(4000) NULL;
ALTER TABLE dbo.imports ADD consignment_value DECIMAL(22, 2) NULL;
ALTER TABLE dbo.imports ADD invoice_number NVARCHAR(50) NULL;
ALTER TABLE dbo.imports ADD container_count INT NULL
    CONSTRAINT ck_imports_container_count CHECK (container_count >= 0);
-- "Single": one invoice; "Multiple": more may be added.
ALTER TABLE dbo.imports ADD invoice_type VARCHAR(10) NOT NULL
    CONSTRAINT df_imports_invoice_type DEFAULT 'single'
    CONSTRAINT ck_imports_invoice_type CHECK (invoice_type IN ('single', 'multiple'));

-- Bill of Lading numbers: one or more per import.
CREATE TABLE dbo.import_bl_numbers (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_import_bl_numbers_id DEFAULT NEWSEQUENTIALID(),
    import_id   UNIQUEIDENTIFIER NOT NULL,
    line_number INT              NOT NULL,   -- order on the form, from 1
    bl_number   NVARCHAR(100)    NULL,
    CONSTRAINT pk_import_bl_numbers PRIMARY KEY (id),
    CONSTRAINT fk_import_bl_numbers_import FOREIGN KEY (import_id) REFERENCES dbo.imports (id) ON DELETE CASCADE,
    CONSTRAINT ux_import_bl_numbers_line UNIQUE (import_id, line_number)
);

-- Invoices (old Map_ImpExpInvoice).
CREATE TABLE dbo.import_invoices (
    id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_import_invoices_id DEFAULT NEWSEQUENTIALID(),
    import_id      UNIQUEIDENTIFIER NOT NULL,
    line_number    INT              NOT NULL,
    invoice_number NVARCHAR(500)    NULL,
    invoice_date   DATE             NULL,
    fob_value      DECIMAL(21, 2)   NULL,
    supplier_name  NVARCHAR(500)    NULL,
    CONSTRAINT pk_import_invoices PRIMARY KEY (id),
    CONSTRAINT fk_import_invoices_import FOREIGN KEY (import_id) REFERENCES dbo.imports (id) ON DELETE CASCADE,
    CONSTRAINT ux_import_invoices_line UNIQUE (import_id, line_number)
);

-- Containers (old Map_ImpExpContainar); only Sea Container Import has them.
CREATE TABLE dbo.import_containers (
    id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_import_containers_id DEFAULT NEWSEQUENTIALID(),
    import_id        UNIQUEIDENTIFIER NOT NULL,
    line_number      INT              NOT NULL,
    container_number NVARCHAR(100)    NULL,
    container_size   VARCHAR(10)      NULL,     -- 20, 40 or other (old list of values 23-25)
    seal_number      NVARCHAR(200)    NULL,
    CONSTRAINT pk_import_containers PRIMARY KEY (id),
    CONSTRAINT fk_import_containers_import FOREIGN KEY (import_id) REFERENCES dbo.imports (id) ON DELETE CASCADE,
    CONSTRAINT ux_import_containers_line UNIQUE (import_id, line_number),
    CONSTRAINT ck_import_containers_size CHECK (container_size IN ('20', '40', 'other'))
);

-- Items (old Map_ImpExpItem): what the enterprise enters. Rates come from the HSE code.
CREATE TABLE dbo.import_items (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_import_items_id DEFAULT NEWSEQUENTIALID(),
    import_id   UNIQUEIDENTIFIER NOT NULL,
    line_number INT              NOT NULL,
    item_name   NVARCHAR(300)    NULL,
    fob_value   DECIMAL(22, 2)   NULL,
    quantity    DECIMAL(22, 3)   NULL,
    unit_id     UNIQUEIDENTIFIER NULL,
    unit_price  DECIMAL(22, 4)   NULL,
    hse_code_id UNIQUEIDENTIFIER NULL,
    CONSTRAINT pk_import_items PRIMARY KEY (id),
    CONSTRAINT fk_import_items_import FOREIGN KEY (import_id) REFERENCES dbo.imports (id) ON DELETE CASCADE,
    CONSTRAINT fk_import_items_unit FOREIGN KEY (unit_id) REFERENCES dbo.measurement_units (id),
    CONSTRAINT fk_import_items_hse_code FOREIGN KEY (hse_code_id) REFERENCES dbo.hse_codes (id),
    CONSTRAINT ux_import_items_line UNIQUE (import_id, line_number)
);

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0009');

COMMIT TRANSACTION;
PRINT '0009_import_form applied.';

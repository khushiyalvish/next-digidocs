/*
  0010_key_info_fields - which key-information fields each Particular's form shows, with its label
  and whether Submit requires it: old M_KeyInfoInput (key_info_fields) and Map_KeyInputParticular
  (transaction_type_key_fields), copied from the live old database LFZ_DigidocsNew on 2026-10-15
  (read-only SELECTs, with the owner's go-ahead; the import rows, ids 24-46, are in no dump).
  Reference data: changed only by new migrations (decision log 2026-10-08).

  field_key is the name the code knows a field by (src/features/imports/form.ts for imports);
  legacy_id is the old KeyInfoInputId / KeyInputParticularId. Labels are copied as they were,
  without trailing spaces. Old Particular ids are matched through transaction_types.legacy_id.

  Run against DigiDocsOPNext after 0009 (see database/README.md):
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0010_key_info_fields.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
  Never edit this file after it has been applied anywhere; add a new one instead.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0010')
BEGIN
    PRINT '0010_key_info_fields is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

-- The fields a form can have (old M_KeyInfoInput).
CREATE TABLE dbo.key_info_fields (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_key_info_fields_id DEFAULT NEWSEQUENTIALID(),
    direction   VARCHAR(10)      NOT NULL,   -- import or export
    field_key   VARCHAR(40)      NOT NULL,   -- the code's name for it
    field_name  NVARCHAR(100)    NOT NULL,   -- the old InputName
    legacy_id   INT              NOT NULL,   -- the old KeyInfoInputId
    is_active   BIT              NOT NULL CONSTRAINT df_key_info_fields_is_active DEFAULT 1,
    created_at  DATETIMEOFFSET   NOT NULL CONSTRAINT df_key_info_fields_created_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT pk_key_info_fields PRIMARY KEY (id),
    CONSTRAINT ck_key_info_fields_direction CHECK (direction IN ('import', 'export')),
    CONSTRAINT ux_key_info_fields_key UNIQUE (direction, field_key),
    CONSTRAINT ux_key_info_fields_legacy UNIQUE (legacy_id)
);

-- Which fields each Particular shows, its label there, and whether Submit requires it (old Map_KeyInputParticular).
CREATE TABLE dbo.transaction_type_key_fields (
    id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_transaction_type_key_fields_id DEFAULT NEWSEQUENTIALID(),
    transaction_type_id UNIQUEIDENTIFIER NOT NULL,
    key_info_field_id   UNIQUEIDENTIFIER NOT NULL,
    field_label         NVARCHAR(200)    NOT NULL,
    is_mandatory        BIT              NOT NULL,
    legacy_id           INT              NOT NULL,   -- the old KeyInputParticularId
    is_active           BIT              NOT NULL CONSTRAINT df_transaction_type_key_fields_is_active DEFAULT 1,
    created_at          DATETIMEOFFSET   NOT NULL CONSTRAINT df_transaction_type_key_fields_created_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT pk_transaction_type_key_fields PRIMARY KEY (id),
    CONSTRAINT fk_transaction_type_key_fields_type FOREIGN KEY (transaction_type_id) REFERENCES dbo.transaction_types (id),
    CONSTRAINT fk_transaction_type_key_fields_field FOREIGN KEY (key_info_field_id) REFERENCES dbo.key_info_fields (id),
    CONSTRAINT ux_transaction_type_key_fields UNIQUE (transaction_type_id, key_info_field_id)
);

INSERT INTO dbo.key_info_fields (legacy_id, direction, field_key, field_name, is_active) VALUES
    (1, 'export', 'buyerName', N'Buyers Name', 1),
    (2, 'export', 'buyerTin', N'Buyer Tin', 1),
    (3, 'export', 'waybillNumber', N'Bill of Lading / Waybill No', 1),
    (4, 'export', 'destinationCountryId', N'Country Export', 1),
    (5, 'export', 'buyerLocation', N'Location Of Buyer', 1),
    (6, 'export', 'clearingAgentId', N'Clearing Agent', 1),
    (7, 'export', 'shippingMode', N'Shipping Mode', 1),
    (8, 'export', 'consignmentCurrencyId', N'Consignment Currency', 1),
    (9, 'export', 'consignmentValue', N'Consignment Transaction Value', 1),
    (10, 'export', 'commercialInvoiceNumber', N'Commercial Invoice No', 1),
    (11, 'export', 'packingListNumber', N'Packaging List No', 1),
    (12, 'export', 'shipmentQuantityCbm', N'Shipment Qty (cbm)', 1),
    (13, 'export', 'containerCount', N'No. of Container', 1),
    (14, 'export', 'unitId', N'Unit of Measurement', 1),
    (15, 'export', 'exportQuantity', N'Export Quantity', 1),
    (16, 'export', 'exportValue', N'Export Value', 1),
    (17, 'export', 'truckContainerNumber', N'Truck Number / Container Number', 1),
    (18, 'export', 'sealNumber', N'Seal Number', 1),
    (19, 'export', 'loadingPortId', N'Port Of Loading', 1),
    (20, 'export', 'loadingPlace', N'Place Of Loading', 1),
    (21, 'export', 'freeZoneId', N'Free Zone', 1),
    (22, 'export', 'exchangeRate', N'Exchange Rate', 1),
    (23, 'export', 'dischargePortId', N'Port Of Discharge', 1),
    (24, 'import', 'supplierName', N'Supplier Name', 1),
    (25, 'import', 'shippingMode', N'Shipping Mode', 1),
    (26, 'import', 'invoiceNumber', N'Invoice No', 1),
    (27, 'import', 'packingListNumber', N'Pack List No', 1),
    (28, 'import', 'importCountryId', N'Country Import', 1),
    (29, 'import', 'importStateId', N'State Import', 1),
    (30, 'import', 'blNumbers', N'BL No', 1),
    (31, 'import', 'consignmentCurrencyId', N'Consignment Currency', 1),
    (32, 'import', 'shipmentQuantity', N'Shipment Qty', 1),
    (33, 'import', 'airQuantity', N'Air Qty', 1),
    (34, 'import', 'containerCount', N'No Of Container', 1),
    (35, 'import', 'clearingAgentId', N'Clearing Agent', 1),
    (36, 'import', 'consignmentValue', N'Consignment Transaction Value', 1),
    (37, 'import', 'freightValue', N'Frieght', 1),
    (38, 'import', 'insuranceValue', N'Insurance', 1),
    (39, 'import', 'materialDescription', N'Material Description', 1),
    (40, 'import', 'dutyPaid', N'Duty Paid', 1),
    (41, 'import', 'dutyReferenceNumber', N'Duty Reference No', 1),
    (42, 'import', 'dischargePortId', N'Port Of Discharge', 1),
    (43, 'import', 'shipmentUnitId', N'Shipment Unit', 1),
    (44, 'import', 'totalCbm', N'Total CBM', 1),
    (45, 'import', 'totalTonnes', N'Total Tonnes', 1),
    (46, 'import', 'dutyPaidFile', N'Duty Paid File', 1);

-- (old KeyInputParticularId, old KeyInfoInputId, old ParticularId, label, mandatory, active)
INSERT INTO dbo.transaction_type_key_fields (legacy_id, transaction_type_id, key_info_field_id, field_label, is_mandatory, is_active)
SELECT v.legacy_id, t.id, f.id, v.label, v.is_mandatory, v.is_active
FROM (VALUES
    -- 1 DRY BULK IMPORT
    (86, 25, 1, N'Shipping Mode', 1, 1),
    (89, 27, 1, N'Packaging List No.', 1, 1),
    (84, 28, 1, N'Country of Origin', 1, 1),
    (95, 30, 1, N'Bill of Lading No. 1(Bill No.)', 1, 1),
    (88, 31, 1, N'Consignment Currency', 1, 1),
    (90, 32, 1, N'Shipment Quantity', 1, 1),
    (85, 35, 1, N'Clearing Agent', 1, 1),
    (93, 37, 1, N'Frieght Value', 1, 1),
    (94, 38, 1, N'Insurance Value', 1, 1),
    (96, 39, 1, N'Description of goods', 1, 1),
    (87, 42, 1, N'Port of Discharge', 1, 1),
    (91, 43, 1, N'Unit of Measurement', 1, 1),
    (92, 44, 1, N'Total CBM', 1, 1),
    -- 2 LIQUID BULK IMPORT
    (73, 25, 2, N'Shipping Mode', 1, 1),
    (76, 27, 2, N'Packaging List No.', 1, 1),
    (71, 28, 2, N'Country of Origin', 1, 1),
    (82, 30, 2, N'Bill of Lading No. 1 (BL No.)', 1, 1),
    (75, 31, 2, N'Consignment Currency', 1, 1),
    (77, 32, 2, N'Shipment Quantity', 1, 1),
    (72, 35, 2, N'Clearing Agent', 1, 1),
    (80, 37, 2, N'Frieght Value', 1, 1),
    (81, 38, 2, N'Insurance Value', 1, 1),
    (83, 39, 2, N'Description of goods', 1, 1),
    (74, 42, 2, N'Port of Discharge', 1, 1),
    (78, 43, 2, N'Unit of Measurement', 1, 1),
    (79, 45, 2, N'Total Tonnes', 1, 1),
    -- 3 SEA CONTAINER IMPORT
    (44, 25, 3, N'Shipping Mode', 1, 1),
    (47, 27, 3, N'Packaging List No.', 1, 1),
    (42, 28, 3, N'Country of Origin', 1, 1),
    (50, 30, 3, N'Bill of Lading', 1, 1),
    (46, 31, 3, N'Consignment Currency', 1, 1),
    (43, 35, 3, N'Clearing Agent', 1, 1),
    (48, 37, 3, N'Frieght Value', 1, 1),
    (49, 38, 3, N'Insurance Value', 1, 1),
    (51, 39, 3, N'Description of goods', 1, 1),
    (45, 42, 3, N'Port of Discharge', 1, 1),
    -- 8 LOCAL IMPORT
    (59, 25, 8, N'Shipping Mode', 1, 1),
    (62, 27, 8, N'Packaging List No.', 1, 1),
    (58, 29, 8, N'State of Origin', 1, 1),
    (66, 30, 8, N'WayBill/Bill Of Lading', 1, 1),
    (61, 31, 8, N'Consignment Currency', 1, 1),
    (63, 32, 8, N'Shipment Quantity', 1, 1),
    (67, 39, 8, N'Description of goods', 1, 1),
    (68, 40, 8, N'Duty Paid', 1, 1),
    (69, 41, 8, N'Duty Reference No.', 1, 1),
    (64, 43, 8, N'Unit of Measurement', 1, 1),
    (65, 45, 8, N'Total Tonnes', 1, 1),
    (70, 46, 8, N'Duty Paid File', 1, 1),
    -- 9 LOCAL PURCHASE
    (53, 25, 9, N'Shipping Mode', 1, 1),
    (52, 29, 9, N'State of Origin', 1, 1),
    (57, 30, 9, N'Purchase Order', 1, 1),
    (54, 31, 9, N'Consignment Currency', 1, 1),
    (55, 32, 9, N'Shipment Quantity', 1, 1),
    (56, 43, 9, N'Unit of Measurement', 1, 1),
    -- 13 LOCAL EXPORT
    (1, 1, 13, N'Buyer''s Name', 1, 1),
    (2, 2, 13, N'Buyer Tin', 1, 1),
    (3, 3, 13, N'Bill of Lading / Waybill No', 1, 1),
    (4, 5, 13, N'Location Of Buyer', 1, 1),
    (5, 6, 13, N'Clearing Agent', 1, 1),
    (6, 7, 13, N'Shipping Mode', 1, 1),
    (7, 8, 13, N'Consignment Currency', 1, 1),
    (8, 10, 13, N'Commercial Invoice No', 1, 1),
    (9, 11, 13, N'Packaging List No', 1, 1),
    (13, 13, 13, N'No. of Container / Truck', 1, 1),
    (10, 14, 13, N'Unit of Measurement', 1, 1),
    (11, 15, 13, N'Export Quantity', 1, 1),
    (12, 16, 13, N'Export Value', 1, 1),
    (14, 19, 13, N'Port of Discharge', 1, 1),
    (15, 20, 13, N'Place Of Loading', 1, 1),
    -- 14 INTERNATIONAL EXPORT
    (16, 1, 14, N'Buyer''s Name', 1, 1),
    (17, 4, 14, N'Country of Destination', 1, 1),
    (18, 6, 14, N'Clearing Agent', 1, 1),
    (19, 7, 14, N'Shipping Mode', 1, 1),
    (20, 8, 14, N'Consignment Currency', 1, 1),
    (21, 10, 14, N'Commercial Invoice No', 1, 1),
    (22, 11, 14, N'Packaging List No', 1, 1),
    (23, 13, 14, N'No. of Container / Truck', 1, 1),
    (24, 14, 14, N'Unit of Measurement', 1, 1),
    (25, 15, 14, N'Export Quantity', 1, 1),
    (26, 16, 14, N'Export Value', 1, 1),
    (27, 19, 14, N'Port Of Loading', 1, 1),
    (28, 20, 14, N'Place Of Loading', 1, 0),
    (29, 23, 14, N'Port Of Discharge', 1, 1),
    -- 17 AIR SHIPMENT
    (32, 25, 17, N'Shipping Mode', 1, 1),
    (35, 27, 17, N'Packaging List No.', 1, 1),
    (30, 28, 17, N'Country of Origin', 1, 1),
    (40, 30, 17, N'Air Waybill No.', 1, 1),
    (34, 31, 17, N'Consignment Currency', 1, 1),
    (37, 33, 17, N'Air Quantity', 1, 1),
    (31, 35, 17, N'Clearing Agent', 1, 1),
    (38, 37, 17, N'Frieght Value', 1, 1),
    (39, 38, 17, N'Insurance Value', 1, 1),
    (41, 39, 17, N'Description of goods', 1, 1),
    (33, 42, 17, N'Port of Discharge', 1, 1),
    (36, 44, 17, N'Total CBM', 1, 1)
) AS v (legacy_id, field_legacy_id, particular_legacy_id, label, is_mandatory, is_active)
JOIN dbo.transaction_types t ON t.legacy_id = v.particular_legacy_id
JOIN dbo.key_info_fields f ON f.legacy_id = v.field_legacy_id;

-- Every row above must have found its Particular and its field.
IF (SELECT COUNT(*) FROM dbo.transaction_type_key_fields) <> 95
BEGIN
    RAISERROR('0010: expected 95 Particular fields; a Particular or field was not found. Nothing applied.', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END;

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0010');

COMMIT TRANSACTION;
PRINT '0010_key_info_fields applied.';

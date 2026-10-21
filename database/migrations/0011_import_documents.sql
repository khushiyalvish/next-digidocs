/*
  0011_import_documents - the documents an enterprise uploads with an import (old
  _EnterpriseDocsPartial, Map_ImpExpDocs; decision log 2026-10-15), and the one change to the
  document lists since the March dump 0004 was made from.

  1. Reference data, read from the live old database LFZ_DigidocsNew on 2026-10-15 (read-only,
     owner's go-ahead): a new "Others" document (old id 48, 2026-02-26) replaced the old one (44,
     now inactive); every Particular's optional "Others" link moved from 44 to 48. Every other
     document and link already matches 0004.
  2. dbo.import_documents: one row per uploaded file. The file itself is in the uploads folder
     (setting UPLOADS_DIR) under imports/<import id>/<stored_name>; stored_name is generated
     (a GUID and the type's extension), never the uploader's file name, which is kept only to show
     and to name the download. purpose 'document' is one of the Particular's documents
     (document_type_id); 'duty_paid' is the key-information "Duty Paid File" (old DutyFile).

  Run against DigiDocsOPNext after 0010 (see database/README.md):
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0011_import_documents.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
  Never edit this file after it has been applied anywhere; add a new one instead.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0011')
BEGIN
    PRINT '0011_import_documents is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

-- 1. "Others": 48 replaces 44.
INSERT INTO dbo.document_types (legacy_id, document_name, is_active) VALUES (48, N'Others', 1);
UPDATE dbo.document_types SET is_active = 0 WHERE legacy_id = 44;

UPDATE l
SET document_type_id = (SELECT id FROM dbo.document_types WHERE legacy_id = 48)
FROM dbo.transaction_type_documents l
JOIN dbo.document_types d ON d.id = l.document_type_id
WHERE d.legacy_id = 44;

IF EXISTS (SELECT 1 FROM dbo.transaction_type_documents l JOIN dbo.document_types d ON d.id = l.document_type_id WHERE d.legacy_id = 44)
   OR (SELECT COUNT(*) FROM dbo.transaction_type_documents l JOIN dbo.document_types d ON d.id = l.document_type_id WHERE d.legacy_id = 48) <> 6
BEGIN
    RAISERROR('0011: expected the six "Others" links of 0004 to move from 44 to 48. Nothing applied.', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END;

-- 2. Uploaded files of an import.
CREATE TABLE dbo.import_documents (
    id                     UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_import_documents_id DEFAULT NEWSEQUENTIALID(),
    import_id              UNIQUEIDENTIFIER NOT NULL,
    purpose                VARCHAR(20)      NOT NULL,
    document_type_id       UNIQUEIDENTIFIER NULL,       -- for purpose 'document'
    original_name          NVARCHAR(255)    NOT NULL,   -- shown, and the download's name
    stored_name            VARCHAR(60)      NOT NULL,   -- file name in the uploads folder
    content_type           VARCHAR(100)     NOT NULL,
    size_bytes             INT              NOT NULL,
    uploaded_by_account_id UNIQUEIDENTIFIER NULL,       -- NULL again if data:clear removes the person
    uploaded_at            DATETIMEOFFSET   NOT NULL CONSTRAINT df_import_documents_uploaded_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT pk_import_documents PRIMARY KEY (id),
    CONSTRAINT fk_import_documents_import FOREIGN KEY (import_id) REFERENCES dbo.imports (id) ON DELETE CASCADE,
    CONSTRAINT fk_import_documents_document_type FOREIGN KEY (document_type_id) REFERENCES dbo.document_types (id),
    CONSTRAINT fk_import_documents_uploaded_by FOREIGN KEY (uploaded_by_account_id) REFERENCES dbo.user_accounts (id),
    CONSTRAINT ck_import_documents_purpose CHECK (
        (purpose = 'document' AND document_type_id IS NOT NULL) OR (purpose = 'duty_paid' AND document_type_id IS NULL)),
    CONSTRAINT ck_import_documents_size CHECK (size_bytes > 0),
    CONSTRAINT ux_import_documents_stored_name UNIQUE (stored_name)
);
CREATE INDEX ix_import_documents_import ON dbo.import_documents (import_id, purpose, document_type_id);

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0011');

COMMIT TRANSACTION;
PRINT '0011_import_documents applied.';

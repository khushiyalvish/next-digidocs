/*
  0015_import_review - the approval process of an import (old ViewImpExp, UpdateApplicantStatus,
  EnterpriseLetter, ImpExp_Status_U; decision log 2026-10-19):

  1. dbo.import_status_history (old T_ImpExpProcess): one row per step, for the timeline: the
     status it moved to, what was decided, the reason (rejections), the letter uploaded with it,
     and who did it (account id, and the name and role as they were then: no foreign keys, 0012).
  2. Letters are uploads (dbo.import_documents) with their own purpose and no document type:
       lfz_letter            LFZ approves (old document 32 "Lftz Letter")
       nepza_letter          NEPZA approves or re-submits (old 33 "Nepza Letter")
       lfz_approval_letter   LFZ final approval (old 34 "Lftz Approval Letter"; the old app
                             generated it, the owner chose an upload)
     Every letter is kept: a re-uploaded NEPZA letter does not replace the rejected one.

  Run against DigiDocsOPNext after 0014 (see database/README.md):
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0015_import_review.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
  Never edit this file after it has been applied anywhere; add a new one instead.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0015')
BEGIN
    PRINT '0015_import_review is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

-- 1. The steps of an import.
CREATE TABLE dbo.import_status_history (
    id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_import_status_history_id DEFAULT NEWSEQUENTIALID(),
    import_id          UNIQUEIDENTIFIER NOT NULL,
    status_key         VARCHAR(30)      NOT NULL,   -- the status the step moved the import to
    decision           VARCHAR(30)      NOT NULL,   -- created, submitted, approve, reject, final_approve, reject_nepza_letter, resubmit_nepza_letter
    reason             NVARCHAR(2500)   NULL,
    letter_document_id UNIQUEIDENTIFIER NULL,       -- the import_documents row uploaded with the step
    actor_account_id   UNIQUEIDENTIFIER NOT NULL,
    actor_name         NVARCHAR(200)    NOT NULL,   -- as it was then
    actor_role         VARCHAR(20)      NOT NULL,
    created_at         DATETIMEOFFSET   NOT NULL CONSTRAINT df_import_status_history_created_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT pk_import_status_history PRIMARY KEY (id),
    CONSTRAINT ck_import_status_history_status CHECK (status_key IN ('draft', 'enterprise_submitted', 'submitted', 'lfz_saved',
        'lfz_approved', 'lfz_rejected', 'nepza_saved', 'nepza_approved', 'nepza_rejected', 'nepza_letter_rejected', 'completed')),
    CONSTRAINT ck_import_status_history_decision CHECK (decision IN ('created', 'submitted', 'approve', 'reject', 'final_approve',
        'reject_nepza_letter', 'resubmit_nepza_letter'))
);
CREATE INDEX ix_import_status_history_import ON dbo.import_status_history (import_id, created_at);

-- 2. Letters as uploads.
ALTER TABLE dbo.import_documents DROP CONSTRAINT ck_import_documents_purpose;
ALTER TABLE dbo.import_documents ADD CONSTRAINT ck_import_documents_purpose CHECK (
    (purpose = 'document' AND document_type_id IS NOT NULL)
    OR (purpose IN ('duty_paid', 'lfz_letter', 'nepza_letter', 'lfz_approval_letter') AND document_type_id IS NULL));

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0015');

COMMIT TRANSACTION;
PRINT '0015_import_review applied.';

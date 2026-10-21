/*
  0012_drop_foreign_keys - removes every foreign key in the database, so that any table can be
  emptied with TRUNCATE TABLE (SQL Server refuses TRUNCATE on a table a foreign key points at,
  even an empty one). The owner's choice, 2026-10-19 (decision log): it reverses "the database
  enforces references".

  What protected references before is now the application's job:
    - every writer checks the ids it stores against their tables (e.g. checkImportReferences
      for the Add Import form; createImport joins the organisation and the Particular);
    - nothing cascades any more: deleting an import, a person or an organisation does not delete
      what points at it. The app never deletes those (imports are hidden, people and
      organisations deactivated); `npm run data:clear` deletes the lines explicitly.
  CHECK and UNIQUE constraints stay. New migrations add no foreign keys (a unit check enforces it).

  Run against DigiDocsOPNext after 0011 (see database/README.md):
      sqlcmd -S <server> -d DigiDocsOPNext -E -b -f 65001 -i database/migrations/0012_drop_foreign_keys.sql

  Safe to run twice: it records itself in dbo.schema_migrations and stops if already applied.
  Never edit this file after it has been applied anywhere; add a new one instead.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
SET NOCOUNT ON;

BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE migration_id = '0012')
BEGIN
    PRINT '0012_drop_foreign_keys is already applied. Nothing to do.';
    COMMIT TRANSACTION;
    RETURN;
END;

DECLARE @drops NVARCHAR(MAX) = N'';
SELECT @drops = @drops + N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name)
              + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';' + NCHAR(10)
FROM sys.foreign_keys fk
JOIN sys.tables t ON t.object_id = fk.parent_object_id;

PRINT 'Dropping foreign keys:';
PRINT @drops;
EXEC sys.sp_executesql @drops;

IF EXISTS (SELECT 1 FROM sys.foreign_keys)
BEGIN
    RAISERROR('0012: a foreign key is still there. Nothing applied.', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END;

INSERT INTO dbo.schema_migrations (migration_id) VALUES ('0012');

COMMIT TRANSACTION;
PRINT '0012_drop_foreign_keys applied: every table can now be emptied with TRUNCATE TABLE.';

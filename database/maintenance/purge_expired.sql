/*
  Deletes sessions that can never be used again. Safe to run at any time and any number of times
  (idempotent). Schedule it daily (SQL Agent, Windows Task Scheduler + sqlcmd, or by hand):

      sqlcmd -S <server> -d DigiDocs -E -b -i database/maintenance/purge_expired.sql

  Keeps a day of history after expiry so recent problems can still be investigated.
*/
SET NOCOUNT ON;

DELETE FROM dbo.user_sessions
WHERE expires_at < DATEADD(DAY, -1, SYSDATETIMEOFFSET())
   OR revoked_at < DATEADD(DAY, -1, SYSDATETIMEOFFSET());

PRINT 'Expired sessions purged.';

import "server-only";
import { db } from "@/lib/db";
import type { ListScope } from "@/features/workflow/list";
import type { StatusKey } from "@/features/workflow/statuses";
import {
  COMPLETION_BUCKETS,
  STALE_DAYS,
  statusesWaitingOn,
  type DailyFlow,
  type DigiDocsDashboard,
  type EnterpriseRow,
  type PeriodTotals,
  type RankedItem,
  type StatusCounts,
  type WaitingImport,
} from "@/features/dashboard/series";

/*
 * The dashboard's numbers (hub CHILD-APP-GUIDE.md §7.4). Every read takes the list's scope
 * (features/workflow/list.ts `listScope`): only imports in a status the role sees, an Enterprise
 * user's only of their own organisation, narrowed by the chosen Particular and enterprise; hidden
 * imports never count. The flow figures come from the imports' timelines (import_status_history).
 *
 * "A day" is a calendar day by the database's clock, like every other instant (ARCHITECTURE.md
 * §0.8): the days, the period's start and every "how long ago" come from SQL, never from the web
 * server. The period is the last `range` days, today included.
 */

type Scope = Pick<ListScope, "statuses" | "organisationId" | "type">;

const RANKED_ROWS = 6;
const WAITING_ROWS = 8;
const RECENT_STEPS = 8;

/** The last `range` calendar days, oldest first, ending today: for a page with nothing in scope. */
async function calendarDays(range: number): Promise<string[]> {
  const rows = await db.query<{ day_label: string }>`
    WITH day_offsets AS (
      SELECT 0 AS days_back
      UNION ALL
      SELECT days_back + 1 FROM day_offsets WHERE days_back + 1 < ${range}
    )
    SELECT CONVERT(CHAR(10), DATEADD(DAY, -days_back, CAST(SYSDATETIMEOFFSET() AS DATE)), 23) AS day_label
    FROM day_offsets
    ORDER BY days_back DESC
    OPTION (MAXRECURSION 400)`;
  return rows.map((row) => row.day_label);
}

/** Imports in scope per status right now, and how many have not moved for STALE_DAYS. */
async function statusNow(scope: Scope): Promise<StatusCounts> {
  const rows = await db.query<{ status_key: StatusKey; total: number; stale_count: number }>`
    SELECT i.status_key, COUNT(*) AS total,
           SUM(CASE WHEN i.status_key <> 'completed' AND i.updated_at < DATEADD(DAY, -${STALE_DAYS}, SYSDATETIMEOFFSET()) THEN 1 ELSE 0 END) AS stale_count
    FROM dbo.imports i
    WHERE i.deleted_at IS NULL
      AND i.status_key IN (${scope.statuses})
      AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})
      AND (${scope.type} IS NULL OR i.transaction_type_id = ${scope.type})
    GROUP BY i.status_key`;
  return Object.fromEntries(rows.map((row) => [row.status_key, { total: row.total, stale: row.stale_count }]));
}

/**
 * Submissions, completions and rejections per day for the last `range` days, today included —
 * one row per day even when nothing happened — and how many imports were in process (submitted,
 * not completed) when each day ended.
 */
async function dailyFlow(scope: Scope, range: number): Promise<DailyFlow[]> {
  const rows = await db.query<{ day_label: string; submitted_count: number; completed_count: number; rejected_count: number; in_process_count: number }>`
    DECLARE @today DATE = CAST(SYSDATETIMEOFFSET() AS DATE);
    DECLARE @offset INT = DATEPART(TZOFFSET, SYSDATETIMEOFFSET());
    WITH day_offsets AS (
      SELECT 0 AS days_back
      UNION ALL
      SELECT days_back + 1 FROM day_offsets WHERE days_back + 1 < ${range}
    ),
    calendar AS (
      SELECT DATEADD(DAY, -days_back, @today) AS day_date FROM day_offsets
    ),
    scoped AS (
      SELECT i.id
      FROM dbo.imports i
      WHERE i.deleted_at IS NULL
        AND i.status_key IN (${scope.statuses})
        AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})
        AND (${scope.type} IS NULL OR i.transaction_type_id = ${scope.type})
    ),
    steps AS (
      SELECT h.import_id, h.decision, h.created_at
      FROM dbo.import_status_history h
      JOIN scoped s ON s.id = h.import_id
    ),
    counted AS (
      SELECT CAST(created_at AS DATE) AS day_date,
             SUM(CASE WHEN decision = 'submitted' THEN 1 ELSE 0 END) AS submitted_count,
             SUM(CASE WHEN decision = 'final_approve' THEN 1 ELSE 0 END) AS completed_count,
             SUM(CASE WHEN decision IN ('reject', 'reject_nepza_letter') THEN 1 ELSE 0 END) AS rejected_count
      FROM steps
      WHERE created_at >= DATEADD(DAY, -${range}, SYSDATETIMEOFFSET())
      GROUP BY CAST(created_at AS DATE)
    ),
    milestones AS (
      SELECT import_id,
             MIN(CASE WHEN decision = 'submitted' THEN created_at END) AS submitted_at,
             MAX(CASE WHEN decision = 'final_approve' THEN created_at END) AS completed_at
      FROM steps
      GROUP BY import_id
    )
    SELECT CONVERT(CHAR(10), c.day_date, 23) AS day_label,
           COALESCE(n.submitted_count, 0) AS submitted_count,
           COALESCE(n.completed_count, 0) AS completed_count,
           COALESCE(n.rejected_count, 0) AS rejected_count,
           p.in_process_count
    FROM calendar c
    LEFT JOIN counted n ON n.day_date = c.day_date
    CROSS APPLY (
      SELECT TODATETIMEOFFSET(CAST(DATEADD(DAY, 1, c.day_date) AS DATETIME2), @offset) AS day_end
    ) e
    CROSS APPLY (
      SELECT COUNT(*) AS in_process_count
      FROM milestones m
      WHERE m.submitted_at < e.day_end AND (m.completed_at IS NULL OR m.completed_at >= e.day_end)
    ) p
    ORDER BY c.day_date
    OPTION (MAXRECURSION 400)`;

  return rows.map((row) => ({
    day: row.day_label,
    submitted: row.submitted_count,
    completed: row.completed_count,
    rejected: row.rejected_count,
    inProcess: row.in_process_count,
  }));
}

const NO_FLOW: PeriodTotals = {
  submitted: 0,
  completed: 0,
  rejected: 0,
  reviews: 0,
  approvals: 0,
  averageDaysToComplete: null,
  averageLfzHours: null,
  averageNepzaHours: null,
};

const nullableNumber = (value: number | string | null) => (value === null ? null : Number(value));

/**
 * Totals for the period and for the same number of days before it. Review times: from the step
 * before to the reviewer's decision (an LFZ Admin's approvals and rejections, a NEPZA user's
 * approvals, rejections and re-submitted letters).
 */
async function periodTotals(scope: Scope, range: number): Promise<{ current: PeriodTotals; previous: PeriodTotals }> {
  const rows = await db.query<{
    is_current: number;
    submitted_count: number;
    completed_count: number;
    rejected_count: number;
    review_count: number;
    approval_count: number;
    average_days_to_complete: number | null;
    average_lfz_hours: number | null;
    average_nepza_hours: number | null;
  }>`
    DECLARE @today DATE = CAST(SYSDATETIMEOFFSET() AS DATE);
    DECLARE @offset INT = DATEPART(TZOFFSET, SYSDATETIMEOFFSET());
    DECLARE @period_start DATETIMEOFFSET = TODATETIMEOFFSET(CAST(DATEADD(DAY, 1 - ${range}, @today) AS DATETIME2), @offset);
    DECLARE @previous_start DATETIMEOFFSET = DATEADD(DAY, -${range}, @period_start);
    WITH scoped AS (
      SELECT i.id
      FROM dbo.imports i
      WHERE i.deleted_at IS NULL
        AND i.status_key IN (${scope.statuses})
        AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})
        AND (${scope.type} IS NULL OR i.transaction_type_id = ${scope.type})
    ),
    steps AS (
      SELECT h.import_id, h.decision, h.actor_role, h.created_at,
             LAG(h.created_at) OVER (PARTITION BY h.import_id ORDER BY h.created_at, h.id) AS previous_at,
             MIN(CASE WHEN h.decision = 'submitted' THEN h.created_at END) OVER (PARTITION BY h.import_id) AS first_submitted_at
      FROM dbo.import_status_history h
      JOIN scoped s ON s.id = h.import_id
    ),
    periods AS (
      SELECT 1 AS is_current, @period_start AS starts_at, CAST(NULL AS DATETIMEOFFSET) AS ends_at
      UNION ALL
      SELECT 0, @previous_start, @period_start
    )
    SELECT p.is_current,
           SUM(CASE WHEN st.decision = 'submitted' THEN 1 ELSE 0 END) AS submitted_count,
           SUM(CASE WHEN st.decision = 'final_approve' THEN 1 ELSE 0 END) AS completed_count,
           SUM(CASE WHEN st.decision IN ('reject', 'reject_nepza_letter') THEN 1 ELSE 0 END) AS rejected_count,
           SUM(CASE WHEN st.decision IN ('approve', 'final_approve', 'reject', 'reject_nepza_letter') THEN 1 ELSE 0 END) AS review_count,
           SUM(CASE WHEN st.decision IN ('approve', 'final_approve') THEN 1 ELSE 0 END) AS approval_count,
           AVG(CASE WHEN st.decision = 'final_approve' THEN DATEDIFF(MINUTE, st.first_submitted_at, st.created_at) / 1440.0 END) AS average_days_to_complete,
           AVG(CASE WHEN st.actor_role = 'lfz_admin' AND st.decision IN ('approve', 'final_approve', 'reject', 'reject_nepza_letter')
                    THEN DATEDIFF(MINUTE, st.previous_at, st.created_at) / 60.0 END) AS average_lfz_hours,
           AVG(CASE WHEN st.actor_role = 'nepza' AND st.decision IN ('approve', 'reject', 'resubmit_nepza_letter')
                    THEN DATEDIFF(MINUTE, st.previous_at, st.created_at) / 60.0 END) AS average_nepza_hours
    FROM periods p
    LEFT JOIN steps st ON st.created_at >= p.starts_at AND (p.ends_at IS NULL OR st.created_at < p.ends_at)
    GROUP BY p.is_current`;

  const toTotals = (row: (typeof rows)[number] | undefined): PeriodTotals =>
    row
      ? {
          submitted: row.submitted_count,
          completed: row.completed_count,
          rejected: row.rejected_count,
          reviews: row.review_count,
          approvals: row.approval_count,
          averageDaysToComplete: nullableNumber(row.average_days_to_complete),
          averageLfzHours: nullableNumber(row.average_lfz_hours),
          averageNepzaHours: nullableNumber(row.average_nepza_hours),
        }
      : NO_FLOW;
  return { current: toTotals(rows.find((row) => row.is_current === 1)), previous: toTotals(rows.find((row) => row.is_current === 0)) };
}

/** The period's rankings: Particulars and origin countries by submissions, values by currency, completion times. */
async function rankings(scope: Scope, range: number): Promise<Pick<DigiDocsDashboard, "particulars" | "countries" | "values" | "completionTimes">> {
  const [particulars, countries, values, completions] = await Promise.all([
    db.query<RankedItem>`
      DECLARE @period_start DATETIMEOFFSET = TODATETIMEOFFSET(
        CAST(DATEADD(DAY, 1 - ${range}, CAST(SYSDATETIMEOFFSET() AS DATE)) AS DATETIME2), DATEPART(TZOFFSET, SYSDATETIMEOFFSET()));
      SELECT TOP (${RANKED_ROWS}) t.transaction_name AS label, COUNT(*) AS value
      FROM dbo.import_status_history h
      JOIN dbo.imports i ON i.id = h.import_id
      JOIN dbo.transaction_types t ON t.id = i.transaction_type_id
      WHERE h.decision = 'submitted' AND h.created_at >= @period_start
        AND i.deleted_at IS NULL
        AND i.status_key IN (${scope.statuses})
        AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})
        AND (${scope.type} IS NULL OR i.transaction_type_id = ${scope.type})
      GROUP BY t.transaction_name
      ORDER BY COUNT(*) DESC, t.transaction_name`,
    db.query<RankedItem>`
      DECLARE @period_start DATETIMEOFFSET = TODATETIMEOFFSET(
        CAST(DATEADD(DAY, 1 - ${range}, CAST(SYSDATETIMEOFFSET() AS DATE)) AS DATETIME2), DATEPART(TZOFFSET, SYSDATETIMEOFFSET()));
      SELECT TOP (${RANKED_ROWS}) c.country_name AS label, COUNT(DISTINCT i.id) AS value
      FROM dbo.import_status_history h
      JOIN dbo.imports i ON i.id = h.import_id
      JOIN dbo.countries c ON c.id = i.import_country_id
      WHERE h.decision = 'submitted' AND h.created_at >= @period_start
        AND i.deleted_at IS NULL
        AND i.status_key IN (${scope.statuses})
        AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})
        AND (${scope.type} IS NULL OR i.transaction_type_id = ${scope.type})
      GROUP BY c.country_name
      ORDER BY COUNT(DISTINCT i.id) DESC, c.country_name`,
    db.query<{ label: string; value: number | string }>`
      DECLARE @period_start DATETIMEOFFSET = TODATETIMEOFFSET(
        CAST(DATEADD(DAY, 1 - ${range}, CAST(SYSDATETIMEOFFSET() AS DATE)) AS DATETIME2), DATEPART(TZOFFSET, SYSDATETIMEOFFSET()));
      SELECT TOP (${RANKED_ROWS}) cur.iso_code AS label, SUM(v.cif_total) AS value
      FROM dbo.imports i
      JOIN dbo.currencies cur ON cur.id = i.consignment_currency_id
      CROSS APPLY (
        SELECT SUM(COALESCE(it.cif_value, it.fob_value)) AS cif_total FROM dbo.import_items it WHERE it.import_id = i.id
      ) v
      WHERE i.deleted_at IS NULL
        AND i.status_key IN (${scope.statuses})
        AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})
        AND (${scope.type} IS NULL OR i.transaction_type_id = ${scope.type})
        AND EXISTS (
          SELECT 1 FROM dbo.import_status_history h
          WHERE h.import_id = i.id AND h.decision = 'submitted' AND h.created_at >= @period_start
        )
      GROUP BY cur.iso_code
      HAVING SUM(v.cif_total) > 0
      ORDER BY SUM(v.cif_total) DESC, cur.iso_code`,
    db.query<{ bucket: number; total: number }>`
      DECLARE @period_start DATETIMEOFFSET = TODATETIMEOFFSET(
        CAST(DATEADD(DAY, 1 - ${range}, CAST(SYSDATETIMEOFFSET() AS DATE)) AS DATETIME2), DATEPART(TZOFFSET, SYSDATETIMEOFFSET()));
      WITH completed AS (
        SELECT i.id,
               CEILING(DATEDIFF(MINUTE,
                 (SELECT MIN(h.created_at) FROM dbo.import_status_history h WHERE h.import_id = i.id AND h.decision = 'submitted'),
                 f.completed_at) / 1440.0) AS days_taken
        FROM dbo.imports i
        CROSS APPLY (
          SELECT MAX(h.created_at) AS completed_at FROM dbo.import_status_history h WHERE h.import_id = i.id AND h.decision = 'final_approve'
        ) f
        WHERE i.deleted_at IS NULL
          AND i.status_key IN (${scope.statuses})
          AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})
          AND (${scope.type} IS NULL OR i.transaction_type_id = ${scope.type})
          AND f.completed_at >= @period_start
      ),
      bucketed AS (
        SELECT CASE WHEN days_taken <= 3 THEN 0 WHEN days_taken <= 7 THEN 1 WHEN days_taken <= 14 THEN 2 WHEN days_taken <= 30 THEN 3 ELSE 4 END AS bucket
        FROM completed
        WHERE days_taken IS NOT NULL
      )
      SELECT bucket, COUNT(*) AS total FROM bucketed GROUP BY bucket`,
  ]);

  return {
    particulars,
    countries,
    values: values.map((row) => ({ label: row.label.trim(), value: Number(row.value) })),
    completionTimes: COMPLETION_BUCKETS.map((label, index) => ({ label, value: completions.find((row) => row.bucket === index)?.total ?? 0 })),
  };
}

/** Per enterprise: open imports by whose turn it is, stale ones, and the period's submissions and completions. */
async function enterpriseRows(scope: Scope, range: number): Promise<EnterpriseRow[]> {
  const rows = await db.query<{
    id: string;
    short_code: string;
    company_name: string;
    with_enterprise: number;
    with_lfz: number;
    with_nepza: number;
    stale_count: number;
    submitted_period: number;
    completed_period: number;
  }>`
    DECLARE @period_start DATETIMEOFFSET = TODATETIMEOFFSET(
      CAST(DATEADD(DAY, 1 - ${range}, CAST(SYSDATETIMEOFFSET() AS DATE)) AS DATETIME2), DATEPART(TZOFFSET, SYSDATETIMEOFFSET()));
    SELECT o.id, o.short_code, o.company_name,
           SUM(CASE WHEN i.status_key IN (${statusesWaitingOn("enterprise")}) THEN 1 ELSE 0 END) AS with_enterprise,
           SUM(CASE WHEN i.status_key IN (${statusesWaitingOn("lfz")}) THEN 1 ELSE 0 END) AS with_lfz,
           SUM(CASE WHEN i.status_key IN (${statusesWaitingOn("nepza")}) THEN 1 ELSE 0 END) AS with_nepza,
           SUM(CASE WHEN i.status_key <> 'completed' AND i.updated_at < DATEADD(DAY, -${STALE_DAYS}, SYSDATETIMEOFFSET()) THEN 1 ELSE 0 END) AS stale_count,
           COALESCE(SUM(m.submitted_period), 0) AS submitted_period,
           COALESCE(SUM(m.completed_period), 0) AS completed_period
    FROM dbo.imports i
    JOIN dbo.organisations o ON o.id = i.organisation_id
    OUTER APPLY (
      SELECT SUM(CASE WHEN h.decision = 'submitted' THEN 1 ELSE 0 END) AS submitted_period,
             SUM(CASE WHEN h.decision = 'final_approve' THEN 1 ELSE 0 END) AS completed_period
      FROM dbo.import_status_history h
      WHERE h.import_id = i.id AND h.created_at >= @period_start
    ) m
    WHERE i.deleted_at IS NULL
      AND i.status_key IN (${scope.statuses})
      AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})
      AND (${scope.type} IS NULL OR i.transaction_type_id = ${scope.type})
    GROUP BY o.id, o.short_code, o.company_name
    HAVING SUM(CASE WHEN i.status_key <> 'completed' THEN 1 ELSE 0 END) > 0
        OR COALESCE(SUM(m.submitted_period), 0) > 0
        OR COALESCE(SUM(m.completed_period), 0) > 0
    ORDER BY SUM(CASE WHEN i.status_key <> 'completed' THEN 1 ELSE 0 END) DESC, o.short_code`;

  return rows.map((row) => ({
    id: row.id.toLowerCase(),
    code: row.short_code,
    name: row.company_name,
    withEnterprise: row.with_enterprise,
    withLfz: row.with_lfz,
    withNepza: row.with_nepza,
    stale: row.stale_count,
    submittedPeriod: row.submitted_period,
    completedPeriod: row.completed_period,
  }));
}

/** Everything the dashboard shows for this scope and period. */
export async function getDashboard(scope: ListScope, range: number, options: { byEnterprise: boolean }): Promise<DigiDocsDashboard> {
  if (scope.nothing) {
    const days = await calendarDays(range);
    return {
      days: days.map((day) => ({ day, submitted: 0, completed: 0, rejected: 0, inProcess: 0 })),
      current: NO_FLOW,
      previous: NO_FLOW,
      now: {},
      enterprises: [],
      particulars: [],
      countries: [],
      values: [],
      completionTimes: COMPLETION_BUCKETS.map((label) => ({ label, value: 0 })),
    };
  }
  const [now, days, totals, ranked, enterprises] = await Promise.all([
    statusNow(scope),
    dailyFlow(scope, range),
    periodTotals(scope, range),
    rankings(scope, range),
    options.byEnterprise ? enterpriseRows(scope, range) : [],
  ]);
  return { days, now, ...totals, ...ranked, enterprises };
}

/** Open imports in these statuses (within the scope), the longest untouched first. */
export async function listWaitingImports(scope: ListScope, statuses: readonly StatusKey[]): Promise<WaitingImport[]> {
  const wanted = statuses.filter((status) => scope.statuses.includes(status));
  if (scope.nothing || wanted.length === 0) return [];
  const rows = await db.query<{
    id: string;
    tracking_number: string | null;
    short_code: string;
    transaction_name: string;
    status_key: StatusKey;
    minutes_waiting: number;
  }>`
    SELECT TOP (${WAITING_ROWS}) i.id, i.tracking_number, o.short_code, t.transaction_name, i.status_key,
           DATEDIFF(MINUTE, i.updated_at, SYSDATETIMEOFFSET()) AS minutes_waiting
    FROM dbo.imports i
    JOIN dbo.organisations o ON o.id = i.organisation_id
    JOIN dbo.transaction_types t ON t.id = i.transaction_type_id
    WHERE i.deleted_at IS NULL
      AND i.status_key IN (${wanted})
      AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})
      AND (${scope.type} IS NULL OR i.transaction_type_id = ${scope.type})
    ORDER BY i.updated_at, i.id`;
  return rows.map((row) => ({
    id: row.id.toLowerCase(),
    trackingNumber: row.tracking_number ?? "—",
    enterpriseCode: row.short_code,
    particular: row.transaction_name,
    status: row.status_key,
    hoursWaiting: row.minutes_waiting / 60,
  }));
}

/** A step on an import's timeline, for "Recent activity". */
export interface RecentStepDto {
  id: string;
  importId: string;
  trackingNumber: string;
  enterpriseCode: string;
  decision: string;
  status: StatusKey;
  actorName: string;
  at: string;
}

/** The newest timeline steps of the imports in scope (what was done, by whom). Always real, also with sample data on. */
export async function listRecentSteps(scope: ListScope): Promise<RecentStepDto[]> {
  if (scope.nothing) return [];
  const rows = await db.query<{
    id: string;
    import_id: string;
    tracking_number: string | null;
    short_code: string;
    decision: string;
    status_key: StatusKey;
    actor_name: string;
    created_at: Date;
  }>`
    SELECT TOP (${RECENT_STEPS}) h.id, h.import_id, i.tracking_number, o.short_code, h.decision, h.status_key, h.actor_name, h.created_at
    FROM dbo.import_status_history h
    JOIN dbo.imports i ON i.id = h.import_id
    JOIN dbo.organisations o ON o.id = i.organisation_id
    WHERE i.deleted_at IS NULL
      AND i.status_key IN (${scope.statuses})
      AND (${scope.organisationId} IS NULL OR i.organisation_id = ${scope.organisationId})
      AND (${scope.type} IS NULL OR i.transaction_type_id = ${scope.type})
    ORDER BY h.created_at DESC, h.id DESC`;
  return rows.map((row) => ({
    id: row.id.toLowerCase(),
    importId: row.import_id.toLowerCase(),
    trackingNumber: row.tracking_number ?? "—",
    enterpriseCode: row.short_code,
    decision: row.decision,
    status: row.status_key,
    actorName: row.actor_name,
    at: row.created_at.toISOString(),
  }));
}

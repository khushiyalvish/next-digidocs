import type { RoleKey } from "@/features/access/roles";
import type { CardKey } from "@/features/dashboard/steps";
import { canDo } from "@/features/workflow/actions";
import { reviewSteps } from "@/features/workflow/review";
import { REJECTED_STATUSES, STATUS_KEYS, VISIBLE_STATUSES, type StatusKey } from "@/features/workflow/statuses";

/*
 * What the dashboard shows, and the pure rules and arithmetic behind it: who an import waits on,
 * each role's tiles, what needs a look, and the made-up figures behind "Show sample data" (hub
 * CHILD-APP-GUIDE.md §7.4). No database and no clock here.
 */

// ---- Who an import waits on ---------------------------------------------------------------------

/** Who has to act next on an import. */
export type Party = "lfz" | "nepza" | "enterprise";

export const PARTY_LABELS: Record<Party, string> = { lfz: "LFZ", nepza: "NEPZA", enterprise: "Enterprise" };

/**
 * Who an import in this status waits on, from the workflow's own rules: LFZ or NEPZA when their
 * role may take a review step there (workflow/review.ts), the enterprise when it may edit it
 * (workflow/actions.ts). null: nobody (completed).
 */
export function waitingOn(status: StatusKey): Party | null {
  if (reviewSteps("lfz_admin", status).length > 0) return "lfz";
  if (reviewSteps("nepza", status).length > 0) return "nepza";
  if (canDo("import", "enterprise", status, "edit")) return "enterprise";
  return null;
}

/** The statuses that wait on a party (never empty: safe for an IN list). */
export function statusesWaitingOn(party: Party): StatusKey[] {
  return STATUS_KEYS.filter((status) => waitingOn(status) === party);
}

/** The party a role acts for; Account and NIS take no step. */
export function partyOf(role: RoleKey): Party | null {
  return role === "lfz_admin" ? "lfz" : role === "nepza" ? "nepza" : role === "enterprise" ? "enterprise" : null;
}

/** An open import whose last step is older than this has waited too long. */
export const STALE_DAYS = 5;

/** Statuses that are still in process: not completed. */
export const OPEN_STATUSES: readonly StatusKey[] = STATUS_KEYS.filter((status) => status !== "completed");

// ---- The shapes ---------------------------------------------------------------------------------

/** One calendar day (by the database's clock), "YYYY-MM-DD". */
export interface DailyFlow {
  day: string;
  /** Imports submitted to LFTZ that day (a re-submission after a rejection counts again). */
  submitted: number;
  /** Imports that got their final approval that day. */
  completed: number;
  /** Rejections that day: by LFZ, by NEPZA, or of a NEPZA letter. */
  rejected: number;
  /** Imports submitted and not yet completed when the day ended (for today: now). */
  inProcess: number;
}

export interface PeriodTotals {
  submitted: number;
  completed: number;
  rejected: number;
  /** Review decisions taken (approvals and rejections by LFZ and NEPZA), and how many approved. */
  reviews: number;
  approvals: number;
  /** Imports completed in the period: average days from first submission to final approval. */
  averageDaysToComplete: number | null;
  /** Average hours from the step before to an LFZ / NEPZA review decision. */
  averageLfzHours: number | null;
  averageNepzaHours: number | null;
}

/** Imports in one status right now: how many, and how many have waited over STALE_DAYS. */
export interface StatusNow {
  total: number;
  stale: number;
}

export type StatusCounts = Partial<Record<StatusKey, StatusNow>>;

export interface RankedItem {
  label: string;
  value: number;
}

export interface EnterpriseRow {
  /** null on a sample row (it has no page). */
  id: string | null;
  code: string;
  name: string;
  withEnterprise: number;
  withLfz: number;
  withNepza: number;
  /** Open imports that have waited over STALE_DAYS. */
  stale: number;
  submittedPeriod: number;
  completedPeriod: number;
}

export interface WaitingImport {
  /** null on a sample row. */
  id: string | null;
  trackingNumber: string;
  enterpriseCode: string;
  particular: string;
  status: StatusKey;
  hoursWaiting: number;
}

export interface DigiDocsDashboard {
  /** One entry per day of the period, oldest first, ending today. */
  days: DailyFlow[];
  current: PeriodTotals;
  /** The same number of days immediately before `days`. */
  previous: PeriodTotals;
  now: StatusCounts;
  /** Enterprises with an open import, or one submitted or completed in the period. */
  enterprises: EnterpriseRow[];
  /** Submissions in the period by Particular, biggest first. */
  particulars: RankedItem[];
  /** Imports submitted in the period by country of origin, biggest first. */
  countries: RankedItem[];
  /** CIF value of the imports submitted in the period, by consignment currency, biggest first. */
  values: RankedItem[];
  /** Imports completed in the period, by days from submission to final approval, in COMPLETION_BUCKETS order. */
  completionTimes: RankedItem[];
}

export const COMPLETION_BUCKETS = ["Up to 3 days", "4–7 days", "8–14 days", "15–30 days", "Over 30 days"] as const;

// ---- Arithmetic ---------------------------------------------------------------------------------

export function countIn(now: StatusCounts, statuses: readonly StatusKey[]): number {
  return statuses.reduce((sum, status) => sum + (now[status]?.total ?? 0), 0);
}

export function staleIn(now: StatusCounts, statuses: readonly StatusKey[]): number {
  return statuses.reduce((sum, status) => sum + (now[status]?.stale ?? 0), 0);
}

/** `part` of `whole` in whole percent; null when there is no whole. */
export function shareOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** "5 h", "2 d 4 h", "12 days": how long something has waited. */
export function formatWait(hours: number): string {
  if (hours < 1) return "under 1 h";
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours - days * 24);
  return days >= 7 || rest === 0 ? `${days} ${days === 1 ? "day" : "days"}` : `${days} d ${rest} h`;
}

/** Imports by state, for the "By state" bar: in draft, in review, sent back, completed. */
export function byState(now: StatusCounts): { drafts: number; inReview: number; sentBack: number; completed: number } {
  const drafts = countIn(now, ["draft", "enterprise_submitted"]);
  const sentBack = countIn(now, REJECTED_STATUSES);
  const completed = countIn(now, ["completed"]);
  const all = countIn(now, STATUS_KEYS);
  return { drafts, sentBack, completed, inReview: all - drafts - sentBack - completed };
}

// ---- Each role's tiles --------------------------------------------------------------------------

/** A "Right now" tile: imports in these statuses, opening the import list at a step or a status. */
export interface StageTile {
  key: string;
  label: string;
  hint: string;
  statuses: readonly StatusKey[];
  link: { step: CardKey } | { status: StatusKey };
  /** Whose turn it is, for the tile's icon. */
  party: Party | "done";
}

const WITH_LFZ: StageTile = {
  key: "with-lfz",
  label: "Waiting for LFZ review",
  hint: "Submitted, or sent back by NEPZA",
  statuses: ["submitted", "lfz_saved", "nepza_rejected"],
  link: { step: "pending-lfz" },
  party: "lfz",
};
const WITH_NEPZA: StageTile = {
  key: "with-nepza",
  label: "With NEPZA",
  hint: "Approved by LFTZ, waiting for NEPZA",
  statuses: ["lfz_approved", "nepza_saved"],
  link: { step: "pending-nepza" },
  party: "nepza",
};
const FINAL_APPROVAL: StageTile = {
  key: "final-approval",
  label: "Waiting for final approval",
  hint: "Approved by NEPZA, back with LFZ",
  statuses: ["nepza_approved"],
  link: { step: "approval-lftz" },
  party: "lfz",
};
const LETTER_SENT_BACK: StageTile = {
  key: "letter-sent-back",
  label: "NEPZA letter sent back",
  hint: "LFZ rejected the NEPZA letter",
  statuses: ["nepza_letter_rejected"],
  link: { status: "nepza_letter_rejected" },
  party: "nepza",
};
const COMPLETED: StageTile = {
  key: "completed",
  label: "Completed",
  hint: "Fully processed, all time",
  statuses: ["completed"],
  link: { step: "completed" },
  party: "done",
};

const TILES: Record<RoleKey, readonly StageTile[]> = {
  lfz_admin: [
    WITH_LFZ,
    FINAL_APPROVAL,
    WITH_NEPZA,
    { key: "sent-back", label: "Sent back to the enterprise", hint: "Rejected by LFTZ, to correct", statuses: ["lfz_rejected"], link: { status: "lfz_rejected" }, party: "enterprise" },
    LETTER_SENT_BACK,
    COMPLETED,
  ],
  enterprise: [
    { key: "drafts", label: "Drafts", hint: "Saved, not submitted yet", statuses: ["draft"], link: { step: "saved" }, party: "enterprise" },
    { key: "sent-back", label: "Sent back to you", hint: "Rejected by LFTZ: correct and submit again", statuses: ["lfz_rejected"], link: { status: "lfz_rejected" }, party: "enterprise" },
    { ...WITH_LFZ, label: "With LFZ" },
    WITH_NEPZA,
    FINAL_APPROVAL,
    COMPLETED,
  ],
  nepza: [{ ...WITH_NEPZA, label: "Waiting for NEPZA" }, { ...LETTER_SENT_BACK, label: "Letters to re-submit" }, FINAL_APPROVAL, COMPLETED],
  account: [FINAL_APPROVAL, LETTER_SENT_BACK, COMPLETED],
  nis: [],
};

/** The tiles of a role's "Right now", each counting only statuses the role sees. */
export function stageTilesFor(role: RoleKey): StageTile[] {
  const visible = new Set<StatusKey>(VISIBLE_STATUSES[role]);
  return TILES[role].map((tile) => ({ ...tile, statuses: tile.statuses.filter((status) => visible.has(status)) })).filter((tile) => tile.statuses.length > 0);
}

/** The statuses whose imports wait on this role, among those it sees (empty for Account and NIS). */
export function waitingForRole(role: RoleKey): StatusKey[] {
  const party = partyOf(role);
  return party ? VISIBLE_STATUSES[role].filter((status) => waitingOn(status) === party) : [];
}

/**
 * The imports of "Waiting longest": those waiting on the viewer (LFZ, NEPZA, the enterprise), or
 * for Account every open import it sees.
 */
export function waitingListStatuses(role: RoleKey): StatusKey[] {
  const mine = waitingForRole(role);
  return mine.length > 0 ? mine : VISIBLE_STATUSES[role].filter((status) => OPEN_STATUSES.includes(status));
}

// ---- What needs a look --------------------------------------------------------------------------

export interface AttentionItem {
  text: string;
  /** The import list, filtered, or another page. */
  href: string;
  tone: "warning" | "danger";
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * What the viewer should look at, most urgent first; empty when all is well. `listHref` builds the
 * import list's address with the dashboard's filters; `waitingUsers` is for an LFZ Admin only.
 */
export function attentionItems(
  role: RoleKey,
  now: StatusCounts,
  listHref: (filter: { step: CardKey } | { status: StatusKey }) => string,
  waitingUsers = 0,
): AttentionItem[] {
  const visible = (statuses: readonly StatusKey[]) => statuses.filter((status) => VISIBLE_STATUSES[role].includes(status));
  const stale = (statuses: readonly StatusKey[]) => staleIn(now, visible(statuses));
  const count = (statuses: readonly StatusKey[]) => countIn(now, visible(statuses));
  const over = `over ${STALE_DAYS} days`;
  const items: (AttentionItem | false)[] = [];

  if (role === "lfz_admin") {
    items.push(
      stale(WITH_LFZ.statuses) > 0 && {
        text: `${plural(stale(WITH_LFZ.statuses), "import has", "imports have")} waited for LFZ review ${over}`,
        href: listHref(WITH_LFZ.link),
        tone: "danger",
      },
      stale(FINAL_APPROVAL.statuses) > 0 && {
        text: `${plural(stale(FINAL_APPROVAL.statuses), "import has", "imports have")} waited for final approval ${over}`,
        href: listHref(FINAL_APPROVAL.link),
        tone: "danger",
      },
      stale(WITH_NEPZA.statuses) > 0 && {
        text: `${plural(stale(WITH_NEPZA.statuses), "import has", "imports have")} been with NEPZA ${over}`,
        href: listHref(WITH_NEPZA.link),
        tone: "warning",
      },
      waitingUsers > 0 && {
        text: `${plural(waitingUsers, "person has", "people have")} signed in and ${waitingUsers === 1 ? "is" : "are"} waiting for a role`,
        href: "/admin/users?status=waiting",
        tone: "warning",
      },
    );
  }
  if (role === "nepza") {
    items.push(
      stale(WITH_NEPZA.statuses) > 0 && {
        text: `${plural(stale(WITH_NEPZA.statuses), "import has", "imports have")} waited for NEPZA ${over}`,
        href: listHref(WITH_NEPZA.link),
        tone: "danger",
      },
      count(LETTER_SENT_BACK.statuses) > 0 && {
        text: `${plural(count(LETTER_SENT_BACK.statuses), "NEPZA letter was", "NEPZA letters were")} sent back and ${count(LETTER_SENT_BACK.statuses) === 1 ? "needs" : "need"} a new letter`,
        href: listHref(LETTER_SENT_BACK.link),
        tone: "warning",
      },
    );
  }
  if (role === "enterprise") {
    items.push(
      count(["lfz_rejected"]) > 0 && {
        text: `${plural(count(["lfz_rejected"]), "import was", "imports were")} sent back by LFTZ: correct and submit again`,
        href: listHref({ status: "lfz_rejected" }),
        tone: "danger",
      },
      stale(["draft"]) > 0 && {
        text: `${plural(stale(["draft"]), "draft has", "drafts have")} not been touched for ${over}`,
        href: listHref({ step: "saved" }),
        tone: "warning",
      },
      stale(OPEN_STATUSES.filter((status) => waitingOn(status) !== "enterprise")) > 0 && {
        text: `${plural(stale(OPEN_STATUSES.filter((status) => waitingOn(status) !== "enterprise")), "import has", "imports have")} been in review ${over}`,
        href: listHref({ step: "total" }),
        tone: "warning",
      },
    );
  }
  if (role === "account") {
    items.push(
      stale(FINAL_APPROVAL.statuses) > 0 && {
        text: `${plural(stale(FINAL_APPROVAL.statuses), "import has", "imports have")} waited for LFZ final approval ${over}`,
        href: listHref(FINAL_APPROVAL.link),
        tone: "warning",
      },
    );
  }
  return items.filter((item) => item !== false);
}

// ---- Sample data --------------------------------------------------------------------------------

/** A repeatable number from 0 to 1 for a piece of text: the same day always gets the same figure. */
function noise(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

/** 0 = Sunday … 6 = Saturday, from the date's own digits (no clock, no time zone). */
function weekday(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay();
}

/** Made-up enterprises: sample figures are never put under a real enterprise's name. */
export const SAMPLE_ENTERPRISES = [
  { id: "00000000-0000-4000-8000-00000000a001", code: "HBLLFZ", name: "Harbourline Logistics LFTZ Enterprise" },
  { id: "00000000-0000-4000-8000-00000000a002", code: "ATLPKG", name: "Atlantic Packaging LFTZ Enterprise" },
  { id: "00000000-0000-4000-8000-00000000a003", code: "LGSTEEL", name: "Lagoon Steel Works LFTZ Enterprise" },
  { id: "00000000-0000-4000-8000-00000000a004", code: "COASTPH", name: "Coastline Pharma LFTZ Enterprise" },
  { id: "00000000-0000-4000-8000-00000000a005", code: "SUNAGRO", name: "Sunrise Agro Processing LFTZ Enterprise" },
  { id: "00000000-0000-4000-8000-00000000a006", code: "DELTAPRT", name: "Delta Print Technologies LFTZ Enterprise" },
] as const;
const ENTERPRISE_SHARES = [0.27, 0.21, 0.17, 0.14, 0.12, 0.09];

const SAMPLE_PARTICULARS = ["SEA CONTAINER IMPORT", "AIR SHIPMENT", "DRY BULK IMPORT", "LOCAL IMPORT", "LIQUID BULK IMPORT", "LOCAL PURCHASE"];
const PARTICULAR_SHARES = [0.38, 0.22, 0.14, 0.12, 0.08, 0.06];
const SAMPLE_COUNTRIES = ["China", "India", "Germany", "Netherlands", "United Kingdom", "United States"];
const COUNTRY_SHARES = [0.31, 0.19, 0.15, 0.12, 0.09, 0.07];
const SAMPLE_CURRENCIES = ["USD", "EUR", "CNY", "GBP"];
const CURRENCY_SHARES = [0.62, 0.21, 0.11, 0.06];

/** Status counts of the whole zone right now, and how many of each have waited too long. */
const SAMPLE_NOW: Record<StatusKey, StatusNow> = {
  draft: { total: 23, stale: 6 },
  enterprise_submitted: { total: 0, stale: 0 },
  submitted: { total: 17, stale: 3 },
  lfz_saved: { total: 0, stale: 0 },
  lfz_approved: { total: 12, stale: 2 },
  lfz_rejected: { total: 6, stale: 2 },
  nepza_saved: { total: 0, stale: 0 },
  nepza_approved: { total: 8, stale: 1 },
  nepza_rejected: { total: 3, stale: 0 },
  nepza_letter_rejected: { total: 2, stale: 1 },
  completed: { total: 412, stale: 0 },
};

function split(total: number, labels: readonly string[], shares: readonly number[]): RankedItem[] {
  return labels.map((label, index) => ({ label, value: Math.round(total * shares[index]) })).filter((item) => item.value > 0);
}

function scaled(value: number, scale: number): number {
  return Math.round(value * scale);
}

/**
 * Made-up but believable figures for a free zone of about 40 active enterprises, over the real
 * days of the period. `role` keeps to what the role sees; `oneEnterprise` gives one enterprise's
 * share (an Enterprise user, or a chosen sample enterprise) and no ranking of enterprises.
 */
export function sampleDashboard(days: string[], role: RoleKey, oneEnterprise: { code: string; share: number } | null): DigiDocsDashboard {
  const scale = oneEnterprise?.share ?? 1;
  const visible = new Set<StatusKey>(VISIBLE_STATUSES[role]);

  const series: DailyFlow[] = [];
  let inProcess = scaled(48, scale);
  days.forEach((day, index) => {
    const weekend = weekday(day) === 0 || weekday(day) === 6;
    const growth = 0.75 + 0.25 * (days.length > 1 ? index / (days.length - 1) : 1);
    const level = 6.5 * scale * growth * (weekend ? 0.15 : 1);
    const submitted = Math.round(level * (0.7 + 0.6 * noise(`s${day}`)));
    const completed = Math.round(level * (0.65 + 0.6 * noise(`c${day}`)) * (weekend ? 0.5 : 1));
    const rejected = Math.round(level * 0.18 * noise(`r${day}`) * (noise(`x${day}`) > 0.8 ? 3 : 1));
    inProcess = Math.max(0, inProcess + submitted - completed);
    series.push({ day, submitted, completed, rejected, inProcess });
  });

  const submitted = series.reduce((sum, day) => sum + day.submitted, 0);
  const completed = series.reduce((sum, day) => sum + day.completed, 0);
  const rejected = series.reduce((sum, day) => sum + day.rejected, 0);
  const reviews = completed * 3 + rejected;
  const now: StatusCounts = Object.fromEntries(
    STATUS_KEYS.filter((status) => visible.has(status)).map((status) => [
      status,
      { total: scaled(SAMPLE_NOW[status].total, scale), stale: scaled(SAMPLE_NOW[status].stale, scale) },
    ]),
  );

  const enterprises: EnterpriseRow[] = oneEnterprise
    ? []
    : SAMPLE_ENTERPRISES.map((enterprise, index) => {
        const share = ENTERPRISE_SHARES[index];
        const open = (statuses: readonly StatusKey[]) => statuses.filter((status) => visible.has(status)).reduce((sum, status) => sum + SAMPLE_NOW[status].total, 0);
        return {
          id: null,
          code: enterprise.code,
          name: enterprise.name,
          withEnterprise: Math.round(open(statusesWaitingOn("enterprise")) * share),
          withLfz: Math.round(open(statusesWaitingOn("lfz")) * share),
          withNepza: Math.round(open(statusesWaitingOn("nepza")) * share),
          stale: Math.round(5 * share * (0.5 + noise(enterprise.code))),
          submittedPeriod: Math.round(submitted * share),
          completedPeriod: Math.round(completed * share),
        };
      });

  return {
    days: series,
    current: {
      submitted,
      completed,
      rejected,
      reviews,
      approvals: reviews - rejected,
      averageDaysToComplete: 6.4,
      averageLfzHours: 19,
      averageNepzaHours: 31,
    },
    previous: {
      submitted: Math.round(submitted * 0.9),
      completed: Math.round(completed * 0.84),
      rejected: Math.round(rejected * 1.2),
      reviews: Math.round(reviews * 0.88),
      approvals: Math.round((reviews - rejected) * 0.85),
      averageDaysToComplete: 7.6,
      averageLfzHours: 23,
      averageNepzaHours: 29,
    },
    now,
    enterprises,
    particulars: split(submitted, SAMPLE_PARTICULARS, PARTICULAR_SHARES),
    countries: split(submitted * 0.8, SAMPLE_COUNTRIES, COUNTRY_SHARES),
    values: split(submitted * 46_000, SAMPLE_CURRENCIES, CURRENCY_SHARES),
    completionTimes: split(completed, COMPLETION_BUCKETS, [0.24, 0.41, 0.22, 0.1, 0.03]),
  };
}

/** Made-up rows for "Waiting longest". */
export function sampleWaiting(role: RoleKey, oneEnterprise: { code: string } | null): WaitingImport[] {
  // Only statuses the workflow reaches (the sample zone has imports in them).
  const statuses = waitingListStatuses(role).filter((status) => SAMPLE_NOW[status].total > 0);
  if (statuses.length === 0) return [];
  return Array.from({ length: 6 }, (_, index) => {
    const enterprise = oneEnterprise ?? SAMPLE_ENTERPRISES[index % SAMPLE_ENTERPRISES.length];
    const particular = SAMPLE_PARTICULARS[index % 3];
    const code = ["IMP", "ASI", "DBI"][index % 3];
    return {
      id: null,
      trackingNumber: `${enterprise.code}/${code}/2026${String(10 + index).padStart(2, "0")}${String(310 + index * 17).padStart(5, "0")}`,
      enterpriseCode: enterprise.code,
      particular,
      status: statuses[index % statuses.length],
      hoursWaiting: Math.round(190 - index * 29 + 10 * noise(`w${index}`)),
    };
  });
}

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  CircleX,
  FilePen,
  FileX,
  Gauge,
  Hourglass,
  Landmark,
  ListChecks,
  Send,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { RoleKey } from "@/features/access/roles";
import type { RecentStepDto } from "@/features/dashboard/queries";
import { DASHBOARD_RANGES, DEFAULT_DASHBOARD_RANGE, type DashboardRange } from "@/features/dashboard/schemas";
import {
  byState,
  countIn,
  formatWait,
  OPEN_STATUSES,
  PARTY_LABELS,
  shareOf,
  STALE_DAYS,
  staleIn,
  statusesWaitingOn,
  type AttentionItem,
  type DigiDocsDashboard,
  type Party,
  type RankedItem,
  type StageTile,
  type WaitingImport,
} from "@/features/dashboard/series";
import { DECISION_LABELS } from "@/features/workflow/review";
import { STATUS_LABELS, STATUS_TONES, VISIBLE_STATUSES, type StatusKey } from "@/features/workflow/statuses";
import { LocalTime } from "@/components/local-time";
import { buttonClasses } from "@/components/ui/button";
import { compactNumber, formatDay, percentChange } from "@/components/ui/chart-math";
import { BarList, SegmentBar, Sparkline, TrendChart } from "@/components/ui/charts";
import { cx } from "@/components/ui/cx";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, Hero, HeroStat, SectionHeader, StatTile, SwitchLink } from "@/components/ui/primitives";
import { Cell, showFrom, Table } from "@/components/ui/table";
import { AutoSubmitSelect } from "./auto-submit-select";

const RANKED_ROWS = 6;

export interface Choice {
  id: string;
  label: string;
}

/** The dashboard's choices; each is kept in the address bar, defaults left out. */
export interface DashboardChoices {
  range: DashboardRange;
  type?: string;
  enterprise?: string;
  sample: boolean;
}

export function dashboardHref(choices: DashboardChoices): string {
  const params = new URLSearchParams();
  if (choices.range !== DEFAULT_DASHBOARD_RANGE) params.set("range", String(choices.range));
  if (choices.type) params.set("type", choices.type);
  if (choices.enterprise) params.set("enterprise", choices.enterprise);
  if (choices.sample) params.set("sample", "1");
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

const TILE_ICONS: Record<string, LucideIcon> = {
  "with-lfz": Hourglass,
  "final-approval": BadgeCheck,
  "with-nepza": Landmark,
  "sent-back": Undo2,
  "letter-sent-back": FileX,
  drafts: FilePen,
  completed: CheckCircle2,
};

const plural = (count: number, one: string, many: string) => `${compactNumber(count)} ${count === 1 ? one : many}`;

/** "19 h", "1.5 days": an average duration. */
function averageHours(hours: number | null): string {
  if (hours === null) return "—";
  return hours < 48 ? `${Math.round(hours)} h` : `${(hours / 24).toFixed(1).replace(/\.0$/, "")} days`;
}

function averageDays(days: number | null): string {
  return days === null ? "—" : `${days.toFixed(1).replace(/\.0$/, "")} ${days === 1 ? "day" : "days"}`;
}

/** A tile that opens the list behind its number; the tile keeps its own look, this adds the lift. */
function TileLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block min-w-0 rounded-card transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 [&>div]:h-full"
    >
      {children}
    </Link>
  );
}

function StatusBadge({ status }: { status: StatusKey }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}

function RankingCard({ title, description, items, emptyMessage, color = "chart1" }: { title: string; description: string; items: RankedItem[]; emptyMessage: string; color?: "chart1" | "chart2" | "chart3" }) {
  return (
    <Card className="min-w-0">
      <CardHeader title={title} description={description} />
      <CardBody>
        <BarList items={items} color={color} emptyMessage={emptyMessage} />
      </CardBody>
    </Card>
  );
}

/**
 * The home page: where the imports stand, what waits on the viewer, and how the period went.
 * Rendering only — the page above it guards, reads within the viewer's scope and decides between
 * real and sample figures.
 */
export function DashboardView({
  role,
  firstName,
  scopeLabel,
  data,
  tiles,
  attention,
  waiting,
  waitingTitle,
  recent,
  choices,
  particulars,
  enterprises,
  focusLabel,
  listHref,
}: {
  role: RoleKey;
  firstName: string;
  /** Whose imports these are, e.g. "Every enterprise's imports". */
  scopeLabel: string;
  data: DigiDocsDashboard;
  tiles: (StageTile & { href: string })[];
  attention: AttentionItem[];
  waiting: WaitingImport[];
  waitingTitle: string;
  recent: RecentStepDto[];
  choices: DashboardChoices;
  /** The Particulars the viewer may narrow the page to. */
  particulars: Choice[];
  /** The enterprises the viewer may narrow the page to; empty for an Enterprise user. */
  enterprises: Choice[];
  /** The chosen enterprise's name, when one is chosen. */
  focusLabel: string | null;
  /** The import list with the dashboard's Particular and enterprise. */
  listHref: string;
}) {
  const { days, current, previous, now } = data;
  const { range, sample } = choices;
  const dayLabels = days.map((day) => day.day);
  const today = dayLabels.at(-1);
  const versus = `vs previous ${range} days`;
  const state = byState(now);
  const visible = VISIBLE_STATUSES[role];
  const sees = (party: Party) => statusesWaitingOn(party).some((status) => visible.includes(status));
  const parties = (["enterprise", "lfz", "nepza"] as const).filter(sees);
  const openNow = countIn(now, OPEN_STATUSES);
  const staleNow = staleIn(now, OPEN_STATUSES);
  const approvalRate = shareOf(current.approvals, current.reviews);
  const previousApprovalRate = shareOf(previous.approvals, previous.reviews);
  const byEnterprise = data.enterprises.length > 0;
  const busiest = [...data.enterprises]
    .sort((a, b) => b.submittedPeriod - a.submittedPeriod || a.code.localeCompare(b.code))
    .filter((row) => row.submittedPeriod > 0)
    .slice(0, RANKED_ROWS)
    .map((row) => ({ label: row.code, value: row.submittedPeriod }));
  const filtered = Boolean(choices.type || choices.enterprise);
  const empty = "Switch on “Show sample data” to see how this looks.";

  // The hero holds the viewer's own numbers: what waits on them (Account: what waits for final approval), and what got done.
  const mine = role === "account" ? (["nepza_approved"] as StatusKey[]) : tiles.filter((tile) => isMine(role, tile.party)).flatMap((tile) => tile.statuses);

  return (
    <div>
      <Hero
        eyebrow="Welcome back"
        title={`Hello, ${firstName}`}
        description={
          <>
            {scopeLabel}
            {today && ` · ${formatDay(today)}`}
          </>
        }
        aside={
          <>
            <HeroStat
              label={role === "enterprise" ? "To finish or correct" : role === "account" ? "Awaiting final approval" : "Waiting for you"}
              value={compactNumber(countIn(now, mine))}
            />
            <HeroStat label={`Over ${STALE_DAYS} days`} value={compactNumber(staleIn(now, mine))} />
            <HeroStat label={`Completed, ${range} days`} value={compactNumber(current.completed)} />
          </>
        }
      />

      {/* One row of choices above everything they change. They live in the address bar. */}
      <div className="mt-5 mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-card border border-line bg-surface px-3 py-3 shadow-xs sm:px-4">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-3 xl:w-auto xl:flex-1">
          <div className="inline-flex rounded-button border border-line bg-canvas p-0.5" role="group" aria-label="Period">
            {DASHBOARD_RANGES.map((option) => (
              <Link
                key={option}
                href={dashboardHref({ ...choices, range: option })}
                scroll={false}
                aria-current={option === range ? "true" : undefined}
                className={cx(
                  "inline-flex h-9 items-center rounded-button px-3.5 text-sm font-medium whitespace-nowrap transition-colors sm:h-8",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25",
                  option === range ? "bg-primary text-on-primary shadow-xs" : "text-ink-soft hover:bg-subtle hover:text-ink",
                )}
              >
                {option} days
              </Link>
            ))}
          </div>

          {/* A GET form: the choices apply as soon as one changes; the button is for anyone without JavaScript. */}
          <form method="get" action="/" className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto">
            {range !== DEFAULT_DASHBOARD_RANGE && <input type="hidden" name="range" value={range} />}
            {sample && <input type="hidden" name="sample" value="1" />}
            <div className="w-full min-w-0 sm:w-56">
              <AutoSubmitSelect key={choices.type ?? "all"} name="type" defaultValue={choices.type ?? ""} aria-label="Particular">
                <option value="">All particulars</option>
                {particulars.map((particular) => (
                  <option key={particular.id} value={particular.id}>
                    {particular.label}
                  </option>
                ))}
              </AutoSubmitSelect>
            </div>
            {enterprises.length > 0 && (
              <div className="w-full min-w-0 sm:w-72">
                <AutoSubmitSelect key={choices.enterprise ?? "all"} name="enterprise" defaultValue={choices.enterprise ?? ""} aria-label="Enterprise">
                  <option value="">All enterprises</option>
                  {enterprises.map((enterprise) => (
                    <option key={enterprise.id} value={enterprise.id}>
                      {enterprise.label}
                    </option>
                  ))}
                </AutoSubmitSelect>
              </div>
            )}
            <button type="submit" className={cx(buttonClasses("secondary"), "sr-only focus:not-sr-only")}>
              Show
            </button>
            {filtered && (
              <Link href={dashboardHref({ range, sample })} scroll={false} className={buttonClasses("ghost")}>
                Clear
              </Link>
            )}
          </form>
        </div>

        <SwitchLink href={dashboardHref({ ...choices, sample: !sample })} checked={sample}>
          Show sample data
        </SwitchLink>
      </div>

      {sample && (
        <Alert tone="warning" className="-mt-3 mb-8">
          Sample data: the figures, graphs and imports on this page are made up, to show what they look like
          {recent.length > 0 && "; recent activity is real"}. Switch it off to see your own numbers.
        </Alert>
      )}

      <section>
        <SectionHeader
          title="Right now"
          description={`Where ${focusLabel ? `${focusLabel}'s` : role === "enterprise" ? "your" : "the"} imports stand at this moment. Each tile opens its list.`}
        />
        <div className={cx("grid gap-4 sm:grid-cols-2", tiles.length % 3 === 0 ? "lg:grid-cols-3" : "xl:grid-cols-4")}>
          {tiles.map((tile) => {
            const count = countIn(now, tile.statuses);
            const stale = staleIn(now, tile.statuses);
            return (
              <TileLink key={tile.key} href={tile.href}>
                <StatTile
                  label={tile.label}
                  value={stale > 0 && isMine(role, tile.party) ? <span className="text-warning">{compactNumber(count)}</span> : compactNumber(count)}
                  icon={TILE_ICONS[tile.key] ?? ListChecks}
                  hint={
                    tile.party === "done"
                      ? `${compactNumber(current.completed)} in the last ${range} days`
                      : stale > 0
                        ? `${tile.hint} · ${compactNumber(stale)} over ${STALE_DAYS} days`
                        : tile.hint
                  }
                />
              </TileLink>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="min-w-0">
            <CardHeader title="By state" description={`${plural(countIn(now, visible), "import", "imports")} you can see.`} />
            <CardBody>
              <SegmentBar
                segments={[
                  ...(visible.includes("draft") ? [{ label: "Drafts", value: state.drafts, tone: "neutral" as const }] : []),
                  { label: "In review", value: state.inReview, tone: "warning" as const },
                  { label: "Sent back", value: state.sentBack, tone: "danger" as const },
                  { label: "Completed", value: state.completed, tone: "success" as const },
                ]}
              />
            </CardBody>
          </Card>

          <Card className="min-w-0">
            <CardHeader title="Needs a look" description="What is waiting on someone, most urgent first." />
            {attention.length === 0 ? (
              <CardBody className="flex items-center gap-3 text-sm text-ink-soft">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <CheckCircle2 className="size-5" aria-hidden />
                </span>
                Nothing right now.
              </CardBody>
            ) : (
              <ul className="divide-y divide-line-soft">
                {attention.map((item) => (
                  <li key={item.text}>
                    <Link
                      href={item.href}
                      className="group flex items-center gap-3 px-4 py-3.5 text-sm text-ink-soft transition-colors hover:bg-canvas hover:text-ink focus-visible:bg-canvas focus-visible:outline-none sm:px-6"
                    >
                      <span
                        className={cx(
                          "flex size-8 shrink-0 items-center justify-center rounded-full",
                          item.tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
                        )}
                      >
                        <TriangleAlert className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">{item.text}</span>
                      <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="min-w-0">
            <CardHeader
              title="Whose turn it is"
              description={openNow === 0 ? "No import is open." : `${plural(openNow, "open import", "open imports")}, by who acts next.`}
            />
            <CardBody>
              <BarList
                color="chart3"
                items={parties.map((party) => ({ label: party === "enterprise" ? "With the enterprise" : `With ${PARTY_LABELS[party]}`, value: countIn(now, statusesWaitingOn(party)) }))}
                emptyMessage="No import is open."
              />
              {staleNow > 0 && (
                <p className="mt-4 text-[0.8125rem] text-muted">
                  {plural(staleNow, "has", "have")} not moved for over {STALE_DAYS} days.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </section>

      <section className="mt-10">
        <SectionHeader title={`Last ${range} days`} description={`How the imports moved, against the ${range} days before.`} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Submissions" value={compactNumber(current.submitted)} icon={Send} change={percentChange(current.submitted, previous.submitted)} changeLabel={versus}>
            <Sparkline values={days.map((day) => day.submitted)} color="chart1" />
          </StatTile>
          <StatTile
            label="Completed"
            value={compactNumber(current.completed)}
            icon={CheckCircle2}
            change={percentChange(current.completed, previous.completed)}
            changeLabel={versus}
            goodWhen="up"
          >
            <Sparkline values={days.map((day) => day.completed)} color="chart2" />
          </StatTile>
          <StatTile
            label="Rejections"
            value={compactNumber(current.rejected)}
            icon={CircleX}
            change={percentChange(current.rejected, previous.rejected)}
            changeLabel={versus}
            goodWhen="down"
            hint={current.rejected === 0 ? "Nothing was sent back." : undefined}
          >
            <Sparkline values={days.map((day) => day.rejected)} color="danger" />
          </StatTile>
          <StatTile
            label="In process"
            value={compactNumber(days.at(-1)?.inProcess ?? 0)}
            icon={Hourglass}
            hint="Submitted, not completed yet."
          >
            <Sparkline values={days.map((day) => day.inProcess)} color="chart3" />
          </StatTile>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Average time to complete"
            value={averageDays(current.averageDaysToComplete)}
            icon={Timer}
            hint={current.averageDaysToComplete === null ? "No import was completed in this period." : "From submission to final approval."}
            change={
              current.averageDaysToComplete === null || previous.averageDaysToComplete === null
                ? null
                : percentChange(current.averageDaysToComplete, previous.averageDaysToComplete)
            }
            changeLabel={versus}
            goodWhen="down"
          />
          <StatTile
            label="Average LFZ review"
            value={averageHours(current.averageLfzHours)}
            icon={ShieldCheck}
            hint={current.averageLfzHours === null ? "LFZ took no decision in this period." : "From the step before to LFZ's decision."}
            change={current.averageLfzHours === null || previous.averageLfzHours === null ? null : percentChange(current.averageLfzHours, previous.averageLfzHours)}
            changeLabel={versus}
            goodWhen="down"
          />
          <StatTile
            label="Average NEPZA review"
            value={averageHours(current.averageNepzaHours)}
            icon={Landmark}
            hint={current.averageNepzaHours === null ? "NEPZA took no decision in this period." : "From LFZ's approval to NEPZA's decision."}
            change={
              current.averageNepzaHours === null || previous.averageNepzaHours === null ? null : percentChange(current.averageNepzaHours, previous.averageNepzaHours)
            }
            changeLabel={versus}
            goodWhen="down"
          />
          <StatTile
            label="Approved at review"
            value={approvalRate === null ? "—" : `${approvalRate}%`}
            icon={Gauge}
            hint={
              approvalRate === null
                ? "No review decision in this period."
                : `${compactNumber(current.approvals)} of ${plural(current.reviews, "decision", "decisions")}${previousApprovalRate === null ? "" : `; ${previousApprovalRate}% in the ${range} days before`}.`
            }
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="min-w-0 lg:col-span-2">
            <CardHeader title="Flow" description="Submissions, completions and rejections per day." />
            <CardBody>
              <TrendChart
                title={`Imports submitted, completed and rejected per day, last ${range} days`}
                days={dayLabels}
                series={[
                  { label: "Submitted", color: "chart1", values: days.map((day) => day.submitted) },
                  { label: "Completed", color: "chart2", values: days.map((day) => day.completed) },
                  { label: "Rejected", color: "danger", values: days.map((day) => day.rejected) },
                ]}
                emptyMessage={`No import was submitted, completed or rejected in this period. ${empty}`}
              />
            </CardBody>
          </Card>
          {byEnterprise ? (
            <RankingCard title="Busiest enterprises" description="By submissions in the period." items={busiest} emptyMessage="No import was submitted in this period." />
          ) : (
            <RankingCard title="By Particular" description="Submissions in the period." items={data.particulars} emptyMessage="No import was submitted in this period." />
          )}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="min-w-0 lg:col-span-2">
            <CardHeader title="In process" description="Imports submitted and not completed, at the end of each day." />
            <CardBody>
              <TrendChart
                title={`Imports in process at the end of each day, last ${range} days`}
                days={dayLabels}
                series={[{ label: "In process", color: "chart3", values: days.map((day) => day.inProcess) }]}
                emptyMessage={`No import was in process in this period. ${empty}`}
              />
            </CardBody>
          </Card>
          <RankingCard
            title="Time to complete"
            description="Imports completed in the period, by days from submission."
            items={data.completionTimes.some((bucket) => bucket.value > 0) ? data.completionTimes : []}
            emptyMessage="No import was completed in this period."
            color="chart2"
          />
        </div>

        <div className={cx("mt-4 grid gap-4", byEnterprise ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
          {byEnterprise && <RankingCard title="By Particular" description="Submissions in the period." items={data.particulars} emptyMessage="No import was submitted in this period." />}
          <RankingCard title="Countries of origin" description="Imports submitted in the period." items={data.countries} emptyMessage="No import with a country of origin was submitted in this period." />
          <RankingCard
            title="Value submitted"
            description="CIF value of the period's submissions, by consignment currency."
            items={data.values}
            emptyMessage="No import with items was submitted in this period."
            color="chart2"
          />
        </div>
      </section>

      <section className="mt-10">
          <SectionHeader
            title={waitingTitle}
            description="Open imports, the longest untouched first."
            actions={
              <Link href={listHref} className={buttonClasses("secondary", "sm")}>
                All imports <ArrowRight aria-hidden />
              </Link>
            }
          />
          {waiting.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nothing is waiting" description="Imports appear here while it is someone's turn to act on them." />
          ) : (
            <Table
              columns={[
                { label: "Tracking number" },
                ...(role === "enterprise" ? [] : [{ label: "Enterprise", className: showFrom.md }]),
                { label: "Particular", className: showFrom.lg },
                { label: "Status", className: showFrom.sm },
                { label: "Untouched for", className: "text-right" },
                { label: "", className: "w-8" },
              ]}
            >
              {waiting.map((row) => (
                <tr key={row.id ?? row.trackingNumber} className="hover:bg-canvas/80">
                  <Cell>
                    {row.id ? (
                      <Link
                        href={`/imports/${row.id}`}
                        className="block min-w-0 rounded-md font-medium wrap-anywhere text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
                      >
                        {row.trackingNumber}
                      </Link>
                    ) : (
                      <span className="block min-w-0 font-medium wrap-anywhere text-ink">{row.trackingNumber}</span>
                    )}
                    {/* Below the breakpoints the other columns are hidden; their essentials are repeated here. */}
                    <p className="mt-1 text-[0.8125rem] wrap-anywhere text-muted lg:hidden">
                      {role !== "enterprise" && `${row.enterpriseCode} · `}
                      {row.particular}
                    </p>
                    <p className="mt-1 sm:hidden">
                      <StatusBadge status={row.status} />
                    </p>
                  </Cell>
                  {role !== "enterprise" && <Cell className={cx(showFrom.md, "wrap-anywhere")}>{row.enterpriseCode}</Cell>}
                  <Cell className={cx(showFrom.lg, "wrap-anywhere")}>{row.particular}</Cell>
                  <Cell className={showFrom.sm}>
                    <StatusBadge status={row.status} />
                  </Cell>
                  <Cell className="text-right whitespace-nowrap tabular-nums">
                    {row.hoursWaiting >= STALE_DAYS * 24 ? <span className="font-medium text-warning">{formatWait(row.hoursWaiting)}</span> : formatWait(row.hoursWaiting)}
                  </Cell>
                  <Cell className="w-8 pl-0 text-faint">{row.id && <ChevronRight className="size-4" aria-hidden />}</Cell>
                </tr>
              ))}
            </Table>
          )}
      </section>

      {byEnterprise && (
        <section className="mt-10">
          <SectionHeader
            title="By enterprise"
            description={`Enterprises with an open import, or one submitted or completed in the last ${range} days. Choose one to see only its figures.`}
          />
          <Table
            columns={[
              { label: "Enterprise" },
              ...parties.map((party) => ({ label: `With ${PARTY_LABELS[party]}`, className: party === "lfz" ? showFrom.sm : showFrom.md })),
              { label: `Over ${STALE_DAYS} days`, className: showFrom.md },
              { label: `Submitted, ${range} days`, className: showFrom.lg },
              { label: `Completed, ${range} days`, className: showFrom.lg },
            ]}
          >
            {data.enterprises.map((row) => {
              const withParty: Record<Party, number> = { enterprise: row.withEnterprise, lfz: row.withLfz, nepza: row.withNepza };
              return (
                <tr key={row.id ?? row.code} className="hover:bg-canvas/80">
                  <Cell>
                    {row.id ? (
                      <Link
                        href={dashboardHref({ ...choices, enterprise: row.id })}
                        scroll={false}
                        className="block min-w-0 rounded-md font-medium wrap-anywhere text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
                      >
                        {row.code}
                      </Link>
                    ) : (
                      <span className="block font-medium wrap-anywhere text-ink">{row.code}</span>
                    )}
                    <span className="block text-[0.8125rem] wrap-anywhere text-muted">{row.name}</span>
                    {/* Below the breakpoints the other columns are hidden; they are repeated here. */}
                    <span className="block text-[0.8125rem] text-muted md:hidden">
                      {parties.map((party) => `${withParty[party]} with ${PARTY_LABELS[party]}`).join(" · ")} · {row.stale} over {STALE_DAYS} days
                    </span>
                    <span className="block text-[0.8125rem] text-muted lg:hidden">
                      {row.submittedPeriod} submitted, {row.completedPeriod} completed in {range} days
                    </span>
                  </Cell>
                  {parties.map((party) => (
                    <Cell key={party} className={cx(party === "lfz" ? showFrom.sm : showFrom.md, "tabular-nums")}>
                      {withParty[party]}
                    </Cell>
                  ))}
                  <Cell className={cx(showFrom.md, "tabular-nums")}>{row.stale > 0 ? <span className="font-medium text-warning">{row.stale}</span> : 0}</Cell>
                  <Cell className={cx(showFrom.lg, "tabular-nums")}>{row.submittedPeriod}</Cell>
                  <Cell className={cx(showFrom.lg, "tabular-nums")}>{row.completedPeriod}</Cell>
                </tr>
              );
            })}
          </Table>
        </section>
      )}

      <Card className="mt-10">
        <CardHeader
          title="Recent activity"
          description="The latest steps on the imports you can see."
          actions={
            <Link href={listHref} className={buttonClasses("secondary", "sm")}>
              Imports <ArrowRight aria-hidden />
            </Link>
          }
        />
        {recent.length === 0 ? (
          <CardBody className="text-sm text-muted">Steps appear here as imports are submitted and reviewed.</CardBody>
        ) : (
          <ul className="divide-y divide-line-soft">
            {recent.map((step) => (
              <li key={step.id}>
                <Link
                  href={`/imports/${step.importId}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 text-sm transition-colors hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none sm:px-6"
                >
                  <span className="min-w-0 wrap-anywhere">
                    <span className="font-medium text-ink">{DECISION_LABELS[step.decision as keyof typeof DECISION_LABELS] ?? step.decision}</span>
                    <span className="text-muted">
                      {" "}
                      · {step.trackingNumber}
                      {role !== "enterprise" && ` (${step.enterpriseCode})`} · {step.actorName}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.8125rem] text-muted">
                    <LocalTime value={step.at} relative />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Whether a tile's imports wait on this role. */
function isMine(role: RoleKey, party: StageTile["party"]): boolean {
  return (role === "lfz_admin" && party === "lfz") || (role === "nepza" && party === "nepza") || (role === "enterprise" && party === "enterprise");
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { menuFor, menuTrail } from "@/features/access/menu";
import { ROLES } from "@/features/access/roles";
import { requireMember, type Member } from "@/features/auth/guards";
import { getDashboard, listRecentSteps, listWaitingImports } from "@/features/dashboard/queries";
import { dashboardFilterSchema } from "@/features/dashboard/schemas";
import {
  attentionItems,
  SAMPLE_ENTERPRISES,
  sampleDashboard,
  sampleWaiting,
  stageTilesFor,
  waitingForRole,
  waitingListStatuses,
  type StageTile,
} from "@/features/dashboard/series";
import type { CardKey } from "@/features/dashboard/steps";
import { listOrganisationOptions } from "@/features/organisations/queries";
import { listTransactionTypeOptions } from "@/features/reference/queries";
import { countWaitingUsers } from "@/features/users/queries";
import { listScope } from "@/features/workflow/list";
import type { StatusKey } from "@/features/workflow/statuses";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { PageTitle } from "@/app/(app)/page-title";
import { DashboardView, type Choice } from "./dashboard-view";

export const metadata: Metadata = { title: "Home" };

/** One enterprise's share of the sample zone's figures. */
const SAMPLE_ENTERPRISE_SHARE = 0.2;

/**
 * Home: the dashboard (hub CHILD-APP-GUIDE.md §7.4; decision log 2026-10-27). LFZ Admin, NEPZA and
 * Account see every enterprise's imports in the statuses their role sees, and may narrow the page
 * to one enterprise; an Enterprise user sees only their own organisation's. Everyone may narrow it
 * to one Particular and choose the period, and switch on sample data. NIS has no import screens
 * and keeps its menu as shortcut cards.
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const member = await requireMember();
  const tiles = stageTilesFor(member.role);
  if (tiles.length === 0) return <RoleHome user={member} />;

  const filter = dashboardFilterSchema.parse(await searchParams);
  const seesAll = member.role !== "enterprise";
  const [transactionTypes, organisations, waitingUsers] = await Promise.all([
    listTransactionTypeOptions(),
    seesAll && !filter.sample ? listOrganisationOptions() : [],
    member.role === "lfz_admin" ? countWaitingUsers() : 0,
  ]);

  // Only choices the viewer is offered count; with sample data on, the enterprises are made-up ones.
  const particulars: Choice[] = transactionTypes.filter((type) => type.direction === "import").map(({ id, label }) => ({ id, label }));
  const enterprises: Choice[] = !seesAll
    ? []
    : filter.sample
      ? SAMPLE_ENTERPRISES.map((enterprise) => ({ id: enterprise.id, label: `${enterprise.name} (${enterprise.code})` }))
      : organisations.map(({ id, label }) => ({ id, label }));
  const type = particulars.find((particular) => particular.id === filter.type)?.id;
  const focus = enterprises.find((enterprise) => enterprise.id === filter.enterprise) ?? null;
  const realFocusId = filter.sample ? undefined : focus?.id;

  // The same scope as the import list: the role's statuses, an Enterprise user's own organisation.
  const scope = listScope(member, { type, enterprise: realFocusId, page: 1 });
  const [real, waitingReal, recent] = await Promise.all([
    getDashboard(scope, filter.range, { byEnterprise: seesAll && !focus && !filter.sample }),
    filter.sample ? [] : listWaitingImports(scope, waitingListStatuses(member.role)),
    listRecentSteps(scope),
  ]);

  // Sample figures are laid over the real days, so the dates on the graphs are always today's.
  const sampleOne = !seesAll
    ? { code: member.organisationName ?? "Your organisation", share: SAMPLE_ENTERPRISE_SHARE }
    : focus
      ? { code: SAMPLE_ENTERPRISES.find((enterprise) => enterprise.id === focus.id)?.code ?? focus.label, share: SAMPLE_ENTERPRISE_SHARE }
      : null;
  const data = filter.sample ? sampleDashboard(real.days.map((day) => day.day), member.role, sampleOne) : real;
  const waiting = filter.sample ? sampleWaiting(member.role, sampleOne) : waitingReal;

  // The import list with the dashboard's Particular and (real) enterprise.
  const listHref = (link?: StageTile["link"]) => {
    const params = new URLSearchParams();
    if (link && "step" in link) params.set("step", link.step);
    if (link && "status" in link) params.set("status", link.status);
    if (type) params.set("type", type);
    if (realFocusId) params.set("enterprise", realFocusId);
    const query = params.toString();
    return query ? `/imports?${query}` : "/imports";
  };

  const firstName = member.fullName.split(" ")[0] || member.fullName;
  const scopeLabel = seesAll
    ? `${ROLES[member.role].label} · ${focus ? focus.label : "every enterprise"}`
    : `${ROLES[member.role].label} · ${member.organisationName ?? "your organisation"}`;
  const waitingTitle = waitingForRole(member.role).length > 0 ? "Waiting for you, longest first" : "Open imports, longest first";

  return (
    <DashboardView
      role={member.role}
      firstName={firstName}
      scopeLabel={scopeLabel}
      data={data}
      tiles={tiles.map((tile) => ({ ...tile, href: listHref(tile.link) }))}
      attention={attentionItems(member.role, data.now, (link: { step: CardKey } | { status: StatusKey }) => listHref(link), filter.sample ? 0 : waitingUsers)}
      waiting={waiting}
      waitingTitle={waitingTitle}
      recent={recent}
      choices={{ range: filter.range, type, enterprise: focus?.id, sample: filter.sample }}
      particulars={particulars}
      enterprises={enterprises}
      focusLabel={focus?.label ?? null}
      listHref={listHref()}
    />
  );
}

/** NIS (no import screens): their menu as shortcut cards. */
function RoleHome({ user }: { user: Member }) {
  const groups = menuFor(user.role).filter((section) => section.items.length > 0);
  const firstName = user.fullName.split(" ")[0] || user.fullName;

  return (
    <div className="space-y-6">
      <PageTitle trail={menuTrail("/")} title={`Welcome, ${firstName}`} description={user.organisationName ?? ROLES[user.role].label} />
      {groups.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No modules for your role yet" description="NIS users had no screens in the old DigiDocs." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.href} className="min-w-0">
              <CardHeader title={group.label} />
              <CardBody className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-10 items-center justify-between gap-2 rounded-md px-3 text-sm font-medium text-primary hover:bg-subtle"
                  >
                    {item.label}
                    <ArrowRight className="size-4 shrink-0" aria-hidden />
                  </Link>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

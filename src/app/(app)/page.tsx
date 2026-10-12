import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, Filter, Hourglass, Landmark, ShieldCheck, type LucideIcon } from "lucide-react";
import { menuFor, menuTrail } from "@/features/access/menu";
import { ROLES } from "@/features/access/roles";
import { requireMember, type Member } from "@/features/auth/guards";
import { dashboardFilterSchema } from "@/features/dashboard/schemas";
import { cardCounts, DASHBOARD_CARDS, type CardKey } from "@/features/dashboard/steps";
import { countImportsByStatus } from "@/features/imports/queries";
import { listOrganisationOptions } from "@/features/organisations/queries";
import { listTransactionTypeOptions } from "@/features/reference/queries";
import { countWaitingUsers } from "@/features/users/queries";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Alert, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { AutoSubmitSelect } from "./auto-submit-select";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "Home" };

const CARD_ICONS: Record<CardKey, LucideIcon> = {
  total: ClipboardList,
  "pending-lfz": Hourglass,
  "pending-nepza": Landmark,
  "approval-lftz": ShieldCheck,
  completed: CheckCircle2,
};

// Theme tokens per card colour, written out so Tailwind sees every class.
const CARD_COLORS: Record<(typeof DASHBOARD_CARDS)[number]["color"], string> = {
  primary: "border-t-primary text-primary",
  warning: "border-t-warning text-warning",
  "chart-1": "border-t-chart-1 text-chart-1",
  accent: "border-t-accent text-accent",
  success: "border-t-success text-success",
};

/**
 * Home. An LFZ Admin gets the dashboard of old DigiDocs (as D:\Khushiyal\DigidocsNext shows it):
 * the import status summary, filtered by transaction type and enterprise, each card opening the
 * import list at its step. Every other role gets its menu as shortcut cards (old DigiDocs showed
 * them a blank page).
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const user = await requireMember();
  if (user.role !== "lfz_admin") return <RoleHome user={user} />;

  const filter = dashboardFilterSchema.parse(await searchParams);
  const [waiting, transactionTypes, organisations, byStatus] = await Promise.all([
    countWaitingUsers(),
    listTransactionTypeOptions(),
    listOrganisationOptions(),
    countImportsByStatus(filter),
  ]);
  const importTypes = transactionTypes.filter((type) => type.direction === "import");
  const counts = cardCounts(byStatus);

  const listHref = (card: CardKey) => {
    const params = new URLSearchParams({ step: card });
    if (filter.type) params.set("type", filter.type);
    if (filter.enterprise) params.set("enterprise", filter.enterprise);
    return `/imports?${params}`;
  };

  return (
    <div className="space-y-6">
      <PageTitle trail={[...menuTrail("/"), { label: "Dashboard" }]} title="Import status summary" description="Imports at each workflow step. A card opens its list." />

      {waiting > 0 && (
        <Alert tone="warning">
          {waiting === 1 ? "One person has" : `${waiting} people have`} signed in and {waiting === 1 ? "is" : "are"} waiting for a role.{" "}
          <Link href="/admin/users?status=waiting" className="font-medium underline underline-offset-2">
            Assign roles
          </Link>
        </Alert>
      )}

      {/* A GET form: the choices live in the address bar, and apply as soon as one changes. */}
      <Card>
        <form method="get" className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-end sm:px-5">
          <div className="space-y-1.5 sm:w-72">
            <label htmlFor="filter-type" className="block text-sm font-medium text-ink">
              Particular
            </label>
            <AutoSubmitSelect id="filter-type" name="type" defaultValue={filter.type ?? ""}>
              <option value="">All particulars</option>
              {importTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </AutoSubmitSelect>
          </div>
          <div className="space-y-1.5 sm:w-96">
            <label htmlFor="filter-enterprise" className="block text-sm font-medium text-ink">
              Enterprise
            </label>
            <AutoSubmitSelect id="filter-enterprise" name="enterprise" defaultValue={filter.enterprise ?? ""}>
              <option value="">All enterprises</option>
              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>
                  {organisation.label}
                </option>
              ))}
            </AutoSubmitSelect>
          </div>
          {/* The selects apply on change; the button is there for anyone who looks for it, and without JavaScript. */}
          <button type="submit" className={buttonClasses("secondary")}>
            <Filter aria-hidden /> Filter
          </button>
          {(filter.type || filter.enterprise) && (
            <Link href="/" className={buttonClasses("ghost")}>
              Clear filters
            </Link>
          )}
        </form>
      </Card>

      <section aria-label="Status summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {DASHBOARD_CARDS.map((card) => {
          const Icon = CARD_ICONS[card.key];
          return (
            <Link
              key={card.key}
              href={listHref(card.key)}
              className={cx(
                "group flex min-w-0 flex-col rounded-card border border-t-4 border-line bg-surface p-5 shadow-sm shadow-ink/5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
                CARD_COLORS[card.color],
              )}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-sm font-medium text-ink">{card.label}</span>
                <Icon className="size-5 shrink-0 opacity-80" aria-hidden />
              </span>
              <span className="mt-3 text-4xl font-semibold tabular-nums">{counts[card.key].toLocaleString()}</span>
              <span className="mt-2 flex items-center gap-1 text-xs text-muted">
                {card.hint}
                <ArrowRight className="ml-auto size-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" aria-hidden />
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

/** Enterprise, NEPZA, NIS and Account: their menu as shortcut cards. */
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

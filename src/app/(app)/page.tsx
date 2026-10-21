import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, FilePen, Filter, Hourglass, Landmark, ShieldCheck, type LucideIcon } from "lucide-react";
import { menuFor, menuTrail } from "@/features/access/menu";
import { ROLES } from "@/features/access/roles";
import { requireMember, type Member } from "@/features/auth/guards";
import { dashboardFilterSchema } from "@/features/dashboard/schemas";
import { cardCounts, dashboardCardsFor, type CardKey, type DashboardCard } from "@/features/dashboard/steps";
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
  saved: FilePen,
  "pending-lfz": Hourglass,
  "pending-nepza": Landmark,
  "approval-lftz": ShieldCheck,
  completed: CheckCircle2,
};

// Theme tokens per card colour, written out so Tailwind sees every class.
// The card's left edge, and its icon tile (a soft tint of the same colour).
const CARD_COLORS: Record<DashboardCard["color"], { edge: string; icon: string }> = {
  neutral: { edge: "border-l-line-strong", icon: "bg-subtle text-ink-soft" },
  primary: { edge: "border-l-primary", icon: "bg-primary/10 text-primary" },
  warning: { edge: "border-l-warning", icon: "bg-warning/10 text-warning" },
  "chart-1": { edge: "border-l-chart-1", icon: "bg-chart-1/10 text-chart-1" },
  accent: { edge: "border-l-accent", icon: "bg-accent/10 text-accent" },
  success: { edge: "border-l-success", icon: "bg-success/10 text-success" },
};

/**
 * Home. An LFZ Admin gets the dashboard of old DigiDocs (as D:\Khushiyal\DigidocsNext shows it):
 * the import status summary, filtered by transaction type and enterprise, each card opening the
 * import list at its step. An Enterprise user gets the same cards, counting only their own
 * organisation's imports, filtered by transaction type (decision log 2026-10-12). Every other role
 * gets its menu as shortcut cards (old DigiDocs showed them a blank page).
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const user = await requireMember();
  if (user.role !== "lfz_admin" && user.role !== "enterprise") return <RoleHome user={user} />;
  const isAdmin = user.role === "lfz_admin";

  const filter = dashboardFilterSchema.parse(await searchParams);
  const [waiting, transactionTypes, organisations, byStatus] = await Promise.all([
    isAdmin ? countWaitingUsers() : 0,
    listTransactionTypeOptions(),
    isAdmin ? listOrganisationOptions() : [],
    countImportsByStatus(user, filter),
  ]);
  const importTypes = transactionTypes.filter((type) => type.direction === "import");
  const counts = cardCounts(byStatus);
  const cards = dashboardCardsFor(user.role);

  const listHref = (card: CardKey) => {
    const params = new URLSearchParams({ step: card });
    if (filter.type) params.set("type", filter.type);
    if (isAdmin && filter.enterprise) params.set("enterprise", filter.enterprise);
    return `/imports?${params}`;
  };

  return (
    <div className="space-y-6">
      <PageTitle
        trail={[...menuTrail("/"), { label: "Dashboard" }]}
        title="Import status summary"
        description={
          isAdmin
            ? "Imports at each workflow step. A card opens its list."
            : `${user.organisationName ?? "Your organisation"}'s imports at each workflow step. A card opens its list.`
        }
      />

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
          {isAdmin && (
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
          )}
          {/* The selects apply on change; the button is there for anyone who looks for it, and without JavaScript. */}
          <button type="submit" className={buttonClasses("secondary")}>
            <Filter aria-hidden /> Filter
          </button>
          {(filter.type || (isAdmin && filter.enterprise)) && (
            <Link href="/" className={buttonClasses("ghost")}>
              Clear filters
            </Link>
          )}
        </form>
      </Card>

      <section
        aria-label="Status summary"
        className={cx("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", cards.length === 5 ? "xl:grid-cols-5" : "2xl:grid-cols-6")}
      >
        {cards.map((card) => {
          const Icon = CARD_ICONS[card.key];
          const colors = CARD_COLORS[card.color];
          return (
            <Link
              key={card.key}
              href={listHref(card.key)}
              className={cx(
                "group flex min-w-0 flex-col rounded-card border border-l-4 border-line bg-surface p-4 shadow-sm shadow-ink/5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
                colors.edge,
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-xl", colors.icon)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <ArrowRight className="size-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink-soft" aria-hidden />
              </span>
              <span className="mt-4 text-3xl leading-none font-semibold tracking-tight tabular-nums text-ink">{counts[card.key].toLocaleString()}</span>
              <span className="mt-2 text-sm leading-snug font-medium text-ink-soft">{card.label}</span>
              <span className="mt-0.5 text-xs leading-snug text-muted">{card.hint}</span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

/** NEPZA, NIS and Account: their menu as shortcut cards. */
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

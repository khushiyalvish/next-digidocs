import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight, Plus, Search } from "lucide-react";
import { requireRole } from "@/features/auth/guards";
import { listOrganisations, ORGANISATIONS_PAGE_SIZE } from "@/features/organisations/queries";
import { organisationListFilterSchema } from "@/features/organisations/schemas";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { controlHeight, EmptyState, inputClasses } from "@/components/ui/primitives";
import { Cell, showFrom, Table } from "@/components/ui/table";
import { OrganisationStatusBadge } from "../badges";
import { listHref, Pager } from "@/app/(app)/pager";
import { menuTrail } from "@/features/access/menu";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "Organisations" };

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "licence-expired", label: "Licence expired" },
  { value: "inactive", label: "Deactivated" },
] as const;

export default async function OrganisationsPage({ searchParams }: PageProps<"/admin/organisations">) {
  await requireRole("lfz_admin");
  const filter = organisationListFilterSchema.parse(await searchParams);
  const { organisations, total } = await listOrganisations(filter);

  const pageCount = Math.max(1, Math.ceil(total / ORGANISATIONS_PAGE_SIZE));
  const filters = { q: filter.q, status: filter.status };
  const isFiltered = Boolean(filter.q || filter.status);

  return (
    <div>
      <PageTitle
        trail={menuTrail("/admin/organisations")}
        title="Organisations"
        description="The free-zone enterprises whose staff submit imports and exports."
        actions={
          <Link href="/admin/organisations/new" className={buttonClasses("primary")}>
            <Plus aria-hidden /> Add organisation
          </Link>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            name="q"
            type="search"
            defaultValue={filter.q}
            placeholder="Search name, code or registration"
            aria-label="Search name, code or registration"
            className={cx(inputClasses, controlHeight, "pl-9")}
          />
        </div>
        <select
          name="status"
          defaultValue={filter.status ?? ""}
          aria-label="Status"
          className={cx(inputClasses, controlHeight, "w-auto flex-1 pr-8 sm:flex-none")}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClasses("secondary")}>
          Filter
        </button>
        {isFiltered && (
          <Link href="/admin/organisations" className={buttonClasses("ghost")}>
            Clear
          </Link>
        )}
      </form>

      {organisations.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={isFiltered ? "No organisations match these filters" : "No organisations yet"}
          description={isFiltered ? "Try a different search or status." : "Add the first enterprise to get started."}
        />
      ) : (
        <>
          <Table
            columns={[
              { label: "Organisation" },
              { label: "Licence", className: showFrom.lg },
              { label: "Expires", className: showFrom.md },
              { label: "Users", className: showFrom.md },
              { label: "Status", className: showFrom.sm },
              { label: "", className: "w-8" },
            ]}
          >
            {organisations.map((organisation) => (
              <tr key={organisation.id} className="hover:bg-canvas/80">
                <Cell>
                  <Link
                    href={`/admin/organisations/${organisation.id}`}
                    className="block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
                  >
                    <span className="block font-medium wrap-anywhere text-ink">{organisation.companyName}</span>
                    <span className="block text-[0.8125rem] wrap-anywhere text-muted">{organisation.shortCode}</span>
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-muted sm:hidden">
                    <OrganisationStatusBadge isActive={organisation.isActive} isLicenceExpired={organisation.isLicenceExpired} />
                    <span>
                      {organisation.userCount} {organisation.userCount === 1 ? "user" : "users"}
                    </span>
                  </div>
                </Cell>
                <Cell className={cx(showFrom.lg, "wrap-anywhere")}>
                  {organisation.licenceNumber ?? <span className="text-faint">—</span>}
                </Cell>
                <Cell className={cx(showFrom.md, "whitespace-nowrap tabular-nums")}>
                  {organisation.licenceExpiresOn ?? <span className="text-faint">—</span>}
                </Cell>
                <Cell className={cx(showFrom.md, "tabular-nums")}>{organisation.userCount}</Cell>
                <Cell className={showFrom.sm}>
                  <OrganisationStatusBadge isActive={organisation.isActive} isLicenceExpired={organisation.isLicenceExpired} />
                </Cell>
                <Cell className="w-8 pl-0 text-faint">
                  <ChevronRight className="size-4" aria-hidden />
                </Cell>
              </tr>
            ))}
          </Table>
          <Pager
            total={total}
            noun={["organisation", "organisations"]}
            page={filter.page}
            pageCount={pageCount}
            pageHref={(page) => listHref("/admin/organisations", filters, page)}
          />
        </>
      )}
    </div>
  );
}

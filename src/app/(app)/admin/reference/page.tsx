import type { Metadata } from "next";
import Link from "next/link";
import { Search, Tags } from "lucide-react";
import { requireRole } from "@/features/auth/guards";
import { countReferenceLists, HSE_PAGE_SIZE, searchHseCodes } from "@/features/reference/queries";
import { hseSearchSchema } from "@/features/reference/schemas";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Badge, Card, controlHeight, EmptyState, inputClasses, SectionHeader } from "@/components/ui/primitives";
import { Cell, showFrom, Table } from "@/components/ui/table";
import { listHref, Pager } from "@/app/(app)/pager";
import { menuTrail } from "@/features/access/menu";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "Reference data" };

const percent = (value: number) => `${value % 1 === 0 ? value : value.toFixed(2)}%`;

/**
 * The fixed lists the import and export forms choose from (migrations 0004–0005), read-only.
 * A change to them is a new migration (decision log 2026-10-08).
 */
export default async function ReferencePage({ searchParams }: PageProps<"/admin/reference">) {
  await requireRole("lfz_admin");
  const filter = hseSearchSchema.parse(await searchParams);
  const [lists, { codes, total }] = await Promise.all([countReferenceLists(), searchHseCodes(filter)]);
  const pageCount = Math.max(1, Math.ceil(total / HSE_PAGE_SIZE));

  return (
    <div className="space-y-8 sm:space-y-10">
      <PageTitle
        trail={menuTrail("/admin/reference")}
        title="Reference data"
        description="The fixed lists the import and export forms choose from, copied from the old DigiDocs. They change only through a database update."
      />

      <section>
        <SectionHeader title="Lists" />
        <Card className="min-w-0">
          <dl className="grid divide-y divide-line-soft sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
            {lists.map((list) => (
              <div key={list.key} className="flex items-baseline justify-between gap-3 px-4 py-3 sm:px-6">
                <dt className="text-sm text-ink-soft">{list.label}</dt>
                <dd className="text-sm font-semibold tabular-nums text-ink">
                  {list.total.toLocaleString()}
                  {list.active !== list.total && (
                    <span className="ml-1.5 text-[0.8125rem] font-normal text-muted">({list.active.toLocaleString()} active)</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>

      <section>
        <SectionHeader title="HSE codes" description="Duty rates in percent, for the tariff period shown." />
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              name="q"
              type="search"
              defaultValue={filter.q}
              placeholder="Code (starts with) or description"
              aria-label="Search HSE codes"
              className={cx(inputClasses, controlHeight, "pl-9")}
            />
          </div>
          <button type="submit" className={buttonClasses("secondary")}>
            Search
          </button>
          {filter.q && (
            <Link href="/admin/reference" className={buttonClasses("ghost")}>
              Clear
            </Link>
          )}
        </form>

        {codes.length === 0 ? (
          <EmptyState icon={Tags} title="No HSE codes match" description="Try the first digits of a code, or a word from its description." />
        ) : (
          <>
            <Table
              columns={[
                { label: "Code" },
                { label: "Description", className: showFrom.md },
                { label: "Duty", className: showFrom.sm },
                { label: "Levy", className: showFrom.lg },
                { label: "Excise", className: showFrom.lg },
                { label: "VAT", className: showFrom.sm },
                { label: "Period", className: showFrom.xl },
              ]}
            >
              {codes.map((code) => (
                <tr key={code.id}>
                  <Cell>
                    <span className="font-mono text-sm text-ink">{code.hseCode}</span>
                    {!code.isActive && (
                      <span className="ml-2">
                        <Badge>Inactive</Badge>
                      </span>
                    )}
                    {/* Below md the description and the hidden rates are shown here instead. */}
                    <div className="mt-1 text-[0.8125rem] wrap-anywhere text-muted md:hidden">
                      {code.goodsDescription ?? "—"}
                      <span className="block tabular-nums sm:hidden">
                        Duty {percent(code.importDutyRate)} · Levy {percent(code.levyRate)} · Excise {percent(code.exciseRate)} · VAT{" "}
                        {percent(code.vatRate)}
                      </span>
                      <span className="hidden tabular-nums sm:block lg:hidden">
                        Levy {percent(code.levyRate)} · Excise {percent(code.exciseRate)}
                      </span>
                    </div>
                  </Cell>
                  <Cell className={cx(showFrom.md, "wrap-anywhere")}>{code.goodsDescription ?? <span className="text-faint">—</span>}</Cell>
                  <Cell className={cx(showFrom.sm, "tabular-nums")}>{percent(code.importDutyRate)}</Cell>
                  <Cell className={cx(showFrom.lg, "tabular-nums")}>{percent(code.levyRate)}</Cell>
                  <Cell className={cx(showFrom.lg, "tabular-nums")}>{percent(code.exciseRate)}</Cell>
                  <Cell className={cx(showFrom.sm, "tabular-nums")}>{percent(code.vatRate)}</Cell>
                  <Cell className={cx(showFrom.xl, "whitespace-nowrap tabular-nums text-muted")}>
                    {code.validFrom && code.validTo ? `${code.validFrom} – ${code.validTo}` : "—"}
                  </Cell>
                </tr>
              ))}
            </Table>
            <Pager
              total={total}
              noun={["HSE code", "HSE codes"]}
              page={filter.page}
              pageCount={pageCount}
              pageHref={(page) => listHref("/admin/reference", { q: filter.q }, page)}
            />
          </>
        )}
      </section>
    </div>
  );
}

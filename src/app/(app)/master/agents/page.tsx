import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Truck } from "lucide-react";
import { requireMenuItem } from "@/features/auth/guards";
import { listAgents, MASTERS_PAGE_SIZE } from "@/features/masters/queries";
import { masterListFilterSchema } from "@/features/masters/schemas";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Alert, EmptyState } from "@/components/ui/primitives";
import { Cell, showFrom, Table } from "@/components/ui/table";
import { listHref, Pager } from "@/app/(app)/pager";
import { ActiveBadge, ListFilters } from "../master-ui";
import { menuTrail } from "@/features/access/menu";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "List Agent" };

/** Clearing agents (old DigiDocs: ClearingAgent/List). */
export default async function AgentsPage({ searchParams }: PageProps<"/master/agents">) {
  await requireMenuItem("/master/agents");
  const params = await searchParams;
  const filter = masterListFilterSchema.parse(params);
  const { agents, total } = await listAgents(filter);
  const added = typeof params.added === "string" ? params.added.slice(0, 300) : undefined;
  const pageCount = Math.max(1, Math.ceil(total / MASTERS_PAGE_SIZE));

  return (
    <div>
      <PageTitle
        trail={menuTrail("/master/agents")}
        title="Clearing agents"
        description="The agents importers and exporters name on their submissions."
        actions={
          <Link href="/master/agents/new" className={buttonClasses("primary")}>
            <Plus aria-hidden /> Add Agent
          </Link>
        }
      />
      {added && (
        <Alert tone="success" className="mb-6">
          {added} added.
        </Alert>
      )}
      <ListFilters
        path="/master/agents"
        q={filter.q}
        status={filter.status}
        placeholder="Search name, email or phone"
        filtered={Boolean(filter.q || filter.status)}
      />

      {agents.length === 0 ? (
        <EmptyState icon={Truck} title="No clearing agents match" description="Try a different search or status." />
      ) : (
        <>
          <Table
            columns={[
              { label: "Agent" },
              { label: "Email", className: showFrom.md },
              { label: "Phone", className: showFrom.lg },
              { label: "Status", className: showFrom.sm },
              { label: "", className: "w-8" },
            ]}
          >
            {agents.map((agent) => (
              <tr key={agent.id} className="hover:bg-canvas/80">
                <Cell>
                  <Link href={`/master/agents/${agent.id}`} className="block font-medium wrap-anywhere text-ink hover:underline">
                    {agent.agentName}
                  </Link>
                  <div className="mt-1 text-[0.8125rem] wrap-anywhere text-muted md:hidden">
                    {agent.email}
                    {agent.phoneNumber && <span className="block">{agent.phoneNumber}</span>}
                    <span className="mt-1 block sm:hidden">
                      <ActiveBadge isActive={agent.isActive} />
                    </span>
                  </div>
                </Cell>
                <Cell className={cx(showFrom.md, "wrap-anywhere text-ink-soft")}>{agent.email ?? "—"}</Cell>
                <Cell className={cx(showFrom.lg, "whitespace-nowrap tabular-nums text-ink-soft")}>{agent.phoneNumber ?? "—"}</Cell>
                <Cell className={showFrom.sm}>
                  <ActiveBadge isActive={agent.isActive} />
                </Cell>
                <Cell className="w-8 pl-0 text-faint">
                  <ChevronRight className="size-4" aria-hidden />
                </Cell>
              </tr>
            ))}
          </Table>
          <Pager
            total={total}
            noun={["clearing agent", "clearing agents"]}
            page={filter.page}
            pageCount={pageCount}
            pageHref={(page) => listHref("/master/agents", { q: filter.q, status: filter.status }, page)}
          />
        </>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Anchor, ChevronRight } from "lucide-react";
import { requireMenuItem } from "@/features/auth/guards";
import { createPort } from "@/features/masters/actions";
import { listPorts, MASTERS_PAGE_SIZE } from "@/features/masters/queries";
import { masterListFilterSchema, PORT_KIND_LABELS, PORT_KINDS } from "@/features/masters/schemas";
import { ActionForm, FormMessage, SubmitButton } from "@/components/forms/action-form";
import { cx } from "@/components/ui/cx";
import { Card, CardBody, CardFooter, CardHeader, controlHeight, EmptyState, inputClasses } from "@/components/ui/primitives";
import { Cell, showFrom, Table } from "@/components/ui/table";
import { listHref, Pager } from "@/app/(app)/pager";
import { ActiveBadge, ListFilters } from "../master-ui";
import { PortFields } from "./port-fields";
import { menuTrail } from "@/features/access/menu";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "Ports" };

/** Ports of discharge, sea and air (old DigiDocs: ImpExp/Ports). */
export default async function PortsPage({ searchParams }: PageProps<"/master/ports">) {
  await requireMenuItem("/master/ports");
  const filter = masterListFilterSchema.parse(await searchParams);
  const { ports, total } = await listPorts(filter);
  const pageCount = Math.max(1, Math.ceil(total / MASTERS_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageTitle trail={menuTrail("/master/ports")} title="Ports" description="Ports of discharge, sea ports and airports." />

      <Card>
        <CardHeader title="Add port" />
        <ActionForm action={createPort} resetOnSuccess>
          <CardBody className="space-y-4">
            <PortFields />
            <FormMessage />
          </CardBody>
          <CardFooter>
            <SubmitButton>Add port</SubmitButton>
          </CardFooter>
        </ActionForm>
      </Card>

      <section>
        <ListFilters
          path="/master/ports"
          q={filter.q}
          status={filter.status}
          placeholder="Search port name"
          filtered={Boolean(filter.q || filter.status || filter.kind)}
        >
          <select name="kind" defaultValue={filter.kind ?? ""} aria-label="Type" className={cx(inputClasses, controlHeight, "w-auto flex-1 pr-8 sm:flex-none")}>
            <option value="">All types</option>
            {PORT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {PORT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </ListFilters>

        {ports.length === 0 ? (
          <EmptyState icon={Anchor} title="No ports match" description="Try a different search, type or status." />
        ) : (
          <>
            <Table
              columns={[
                { label: "Port" },
                { label: "Type", className: showFrom.sm },
                { label: "Status", className: showFrom.sm },
                { label: "", className: "w-8" },
              ]}
            >
              {ports.map((port) => (
                <tr key={port.id} className="hover:bg-canvas/80">
                  <Cell>
                    <Link href={`/master/ports/${port.id}`} className="block font-medium wrap-anywhere text-ink hover:underline">
                      {port.portName}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-muted sm:hidden">
                      {PORT_KIND_LABELS[port.portKind]}
                      <ActiveBadge isActive={port.isActive} />
                    </div>
                  </Cell>
                  <Cell className={cx(showFrom.sm, "whitespace-nowrap text-ink-soft")}>{PORT_KIND_LABELS[port.portKind]}</Cell>
                  <Cell className={showFrom.sm}>
                    <ActiveBadge isActive={port.isActive} />
                  </Cell>
                  <Cell className="w-8 pl-0 text-faint">
                    <ChevronRight className="size-4" aria-hidden />
                  </Cell>
                </tr>
              ))}
            </Table>
            <Pager
              total={total}
              noun={["port", "ports"]}
              page={filter.page}
              pageCount={pageCount}
              pageHref={(page) => listHref("/master/ports", { q: filter.q, status: filter.status, kind: filter.kind }, page)}
            />
          </>
        )}
      </section>
    </div>
  );
}

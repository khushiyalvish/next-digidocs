import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Search, Users } from "lucide-react";
import { ROLE_KEYS, ROLES, roleLabel } from "@/features/access/roles";
import { requireRole } from "@/features/auth/guards";
import { listUsers, USERS_PAGE_SIZE } from "@/features/users/queries";
import { USER_STATUSES, userListFilterSchema } from "@/features/users/schemas";
import { LocalTime } from "@/components/local-time";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Avatar, controlHeight, EmptyState, inputClasses } from "@/components/ui/primitives";
import { Cell, showFrom, Table } from "@/components/ui/table";
import { USER_STATUS_LABELS, UserStatusBadge } from "../badges";
import { listHref, Pager } from "@/app/(app)/pager";
import { menuTrail } from "@/features/access/menu";
import { PageTitle } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireRole("lfz_admin");
  const filter = userListFilterSchema.parse(await searchParams);
  const { users, total } = await listUsers(filter);

  const pageCount = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const filters = { q: filter.q, role: filter.role, status: filter.status };
  const isFiltered = Boolean(filter.q || filter.role || filter.status);

  return (
    <div>
      <PageTitle
        trail={menuTrail("/admin/users")}
        title="Users"
        description="Everyone who has opened DigiDocs from OnePortal. Give each person a role; enterprise staff also need their organisation."
      />

      {/* A plain GET form: the filters live in the address bar, so they can be bookmarked and shared. */}
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            name="q"
            type="search"
            defaultValue={filter.q}
            placeholder="Search name, email or organisation"
            aria-label="Search name, email or organisation"
            className={cx(inputClasses, controlHeight, "pl-9")}
          />
        </div>
        <select
          name="role"
          defaultValue={filter.role ?? ""}
          aria-label="Role"
          className={cx(inputClasses, controlHeight, "w-auto flex-1 pr-8 sm:flex-none")}
        >
          <option value="">All roles</option>
          {ROLE_KEYS.map((key) => (
            <option key={key} value={key}>
              {ROLES[key].label}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={filter.status ?? ""}
          aria-label="Status"
          className={cx(inputClasses, controlHeight, "w-auto flex-1 pr-8 sm:flex-none")}
        >
          <option value="">All statuses</option>
          {USER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {USER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClasses("secondary")}>
          Filter
        </button>
        {isFiltered && (
          <Link href="/admin/users" className={buttonClasses("ghost")}>
            Clear
          </Link>
        )}
      </form>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={isFiltered ? "No users match these filters" : "No users yet"}
          description={
            isFiltered
              ? "Try a different search, role or status."
              : "People appear here the first time they open DigiDocs from OnePortal."
          }
        />
      ) : (
        <>
          <Table
            columns={[
              { label: "Name" },
              { label: "Role", className: showFrom.md },
              { label: "Organisation", className: showFrom.lg },
              { label: "Status", className: showFrom.md },
              { label: "Last seen", className: showFrom.xl },
              { label: "", className: "w-8" },
            ]}
          >
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-canvas/80">
                <Cell>
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
                  >
                    <Avatar name={user.fullName} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-medium wrap-anywhere text-ink">{user.fullName}</span>
                      <span className="block text-[0.8125rem] wrap-anywhere text-muted">{user.email}</span>
                    </span>
                  </Link>
                  {/* Below md the other columns are hidden; their essentials are shown here instead. */}
                  <div className="mt-2 ml-10 flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-muted md:hidden">
                    <UserStatusBadge status={user.status} />
                    {user.role && <span>{roleLabel(user.role)}</span>}
                    {user.organisationName && <span className="wrap-anywhere">· {user.organisationName}</span>}
                  </div>
                </Cell>
                <Cell className={showFrom.md}>{user.role ? roleLabel(user.role) : <span className="text-faint">—</span>}</Cell>
                <Cell className={cx(showFrom.lg, "wrap-anywhere")}>
                  {user.organisationName ?? <span className="text-faint">—</span>}
                </Cell>
                <Cell className={showFrom.md}>
                  <UserStatusBadge status={user.status} />
                </Cell>
                <Cell className={cx(showFrom.xl, "whitespace-nowrap text-muted")}>
                  <LocalTime value={user.lastSeenAt} relative />
                </Cell>
                <Cell className="w-8 pl-0 text-faint">
                  <ChevronRight className="size-4" aria-hidden />
                </Cell>
              </tr>
            ))}
          </Table>
          <Pager
            total={total}
            noun={["user", "users"]}
            page={filter.page}
            pageCount={pageCount}
            pageHref={(page) => listHref("/admin/users", filters, page)}
          />
        </>
      )}
    </div>
  );
}

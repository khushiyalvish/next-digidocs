import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { menuTrail } from "@/features/access/menu";
import { idSchema } from "@/lib/schemas";
import { ROLE_KEYS, ROLES, roleLabel } from "@/features/access/roles";
import { requireRole } from "@/features/auth/guards";
import { listOrganisationOptions } from "@/features/organisations/queries";
import { saveUserAccess } from "@/features/users/actions";
import { getUserForAdmin } from "@/features/users/queries";
import { ActionForm, CheckboxField, FieldError, FormMessage, SubmitButton, TextField } from "@/components/forms/action-form";
import { LocalTime } from "@/components/local-time";
import { cx } from "@/components/ui/cx";
import { Avatar, Card, CardBody, CardFooter, CardHeader, controlHeight, DescriptionList, inputClasses } from "@/components/ui/primitives";
import { UserStatusBadge } from "../../badges";
import { Breadcrumbs } from "@/app/(app)/page-title";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const admin = await requireRole("lfz_admin");
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();

  const [user, organisations] = await Promise.all([getUserForAdmin(id.data), listOrganisationOptions()]);
  if (!user) notFound();
  const isSelf = user.id === admin.id;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 border-b border-line pb-4">
        <Breadcrumbs trail={[...menuTrail("/admin/users"), { label: user.fullName }]} />
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={user.fullName} size="lg" />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight wrap-anywhere text-ink sm:text-xl">
              {user.fullName}
              <UserStatusBadge status={user.status} />
            </h1>
            <p className="text-sm wrap-anywhere text-muted">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Access"
            description="Name and email come from OnePortal and are refreshed at every sign-in. Changes here apply at this person's next page."
          />
          <ActionForm action={saveUserAccess} hidden={{ userId: user.id }}>
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="role" className="block text-sm font-medium text-ink">
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    defaultValue={user.role ?? ""}
                    disabled={isSelf}
                    className={cx(inputClasses, controlHeight, "pr-8")}
                  >
                    <option value="">No access yet</option>
                    {ROLE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {ROLES[key].label}
                      </option>
                    ))}
                  </select>
                  <FieldError name="role" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="organisationId" className="block text-sm font-medium text-ink">
                    Organisation
                  </label>
                  <select
                    id="organisationId"
                    name="organisationId"
                    defaultValue={user.organisationId ?? ""}
                    className={cx(inputClasses, controlHeight, "pr-8")}
                  >
                    <option value="">— (only for Enterprise users)</option>
                    {organisations.map((organisation) => (
                      <option key={organisation.id} value={organisation.id}>
                        {organisation.label}
                        {organisation.isActive ? "" : " — deactivated"}
                      </option>
                    ))}
                  </select>
                  <FieldError name="organisationId" />
                </div>
              </div>
              <ul className="space-y-1 text-[0.8125rem] text-muted">
                {ROLE_KEYS.map((key) => (
                  <li key={key}>
                    <span className="font-medium text-ink-soft">{ROLES[key].label}:</span> {ROLES[key].description}
                  </li>
                ))}
              </ul>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="mobileNumber"
                  label="Mobile number"
                  type="tel"
                  defaultValue={user.mobileNumber ?? ""}
                  autoComplete="off"
                />
              </div>
              <CheckboxField
                name="isActive"
                label="Active"
                description={
                  isSelf
                    ? "You cannot deactivate your own account or change your own role."
                    : "Unticking ends their DigiDocs sessions now and refuses their next sign-in."
                }
                defaultChecked={user.isActive}
                disabled={isSelf}
              />
              {/* Disabled inputs are not submitted: keep one's own role and status as they are. */}
              {isSelf && (
                <>
                  <input type="hidden" name="role" value="lfz_admin" />
                  <input type="hidden" name="isActive" value="on" />
                </>
              )}
              <FormMessage />
            </CardBody>
            <CardFooter>
              <SubmitButton>Save changes</SubmitButton>
            </CardFooter>
          </ActionForm>
        </Card>

        <Card>
          <CardHeader title="Activity" />
          <CardBody className="py-2">
            <DescriptionList
              items={[
                { label: "Role", value: roleLabel(user.role) },
                { label: "First signed in", value: <LocalTime value={user.createdAt} /> },
                { label: "Last seen", value: <LocalTime value={user.lastSeenAt} /> },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

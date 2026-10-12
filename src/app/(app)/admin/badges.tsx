import { Badge } from "@/components/ui/primitives";
import type { UserStatus } from "@/features/users/schemas";

/* Status badges shared by the administration pages. */

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  waiting: "Waiting for access",
  active: "Active",
  inactive: "Deactivated",
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const tone = status === "active" ? "success" : status === "waiting" ? "warning" : "neutral";
  return <Badge tone={tone}>{USER_STATUS_LABELS[status]}</Badge>;
}

export function OrganisationStatusBadge({ isActive, isLicenceExpired }: { isActive: boolean; isLicenceExpired: boolean }) {
  if (!isActive) return <Badge>Deactivated</Badge>;
  if (isLicenceExpired) return <Badge tone="warning">Licence expired</Badge>;
  return <Badge tone="success">Active</Badge>;
}

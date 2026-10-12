import "server-only";
import type { Db } from "@/lib/db";

/**
 * The audit log: who changed what, when, from where. The only writer of dbo.audit_events.
 * Closed set of event types (the same shape as the hub's), so a future audit page can describe
 * each one.
 */
export const AUDIT_EVENT_TYPES = {
  "admin.user_access_changed": "Changed a user's role, organisation or status",
  "admin.organisation_created": "Added an organisation",
  "admin.organisation_updated": "Updated an organisation",
  "operator.admin_granted": "Made someone an LFZ Admin from the command line",
  "master.bank_created": "Added a bank",
  "master.bank_updated": "Updated a bank",
  "master.agent_created": "Added a clearing agent",
  "master.agent_updated": "Updated a clearing agent",
  "master.port_created": "Added a port",
  "master.port_updated": "Updated a port",
} as const;

export type AuditEventType = keyof typeof AUDIT_EVENT_TYPES;

export interface AuditEvent {
  eventType: AuditEventType;
  actor: { id: string; email: string } | null;
  /** What was acted on, as a readable label ("Jane Doe <jane@corp.com>", "Lekki Port LFTZ"). */
  target?: string | null;
  detail?: string | null;
  ipAddress: string | null;
}

export async function recordAudit(db: Db, event: AuditEvent): Promise<void> {
  await db.query`
    INSERT INTO dbo.audit_events (actor_account_id, actor_email, event_type, target_label, ip_address, detail)
    VALUES (
      ${event.actor?.id ?? null},
      ${event.actor?.email ?? null},
      ${event.eventType},
      ${event.target?.slice(0, 300) ?? null},
      ${event.ipAddress},
      ${event.detail?.slice(0, 1000) ?? null}
    )`;
}

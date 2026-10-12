"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { withTransaction, type Db } from "@/lib/db";
import { getRequestInfo } from "@/lib/request-info";
import { done, fail, invalidInput, notFound, type ActionResult } from "@/lib/result";
import { formToObject } from "@/lib/schemas";
import { recordAudit, type AuditEventType } from "@/features/audit/record";
import { requireMenuItem, type Member } from "@/features/auth/guards";
import {
  agentSchema,
  bankSchema,
  PORT_KIND_LABELS,
  portSchema,
  updateAgentSchema,
  updateBankSchema,
  updatePortSchema,
} from "@/features/masters/schemas";
import { insertAgent, insertBank, insertPort, updateAgent, updateBank, updatePort, type SaveOutcome } from "@/features/masters/writes";

/*
 * The Master screens (the "Master" menu, LFZ Admins). Every action: guard from the menu → parse →
 * write (duplicates refused in the same statement) → audit.
 */

async function audit(member: Member, eventType: AuditEventType, target: string, detail?: string | null) {
  const { ipAddress } = await getRequestInfo();
  return (tx: Db) =>
    recordAudit(tx, { eventType, actor: { id: member.id, email: member.email }, target, detail, ipAddress });
}

function saved(outcome: SaveOutcome, what: string, duplicate: string): ActionResult {
  if (outcome === "not_found") return notFound(what);
  if (outcome === "duplicate") return fail(duplicate, "conflict");
  refresh();
  return done("Changes saved.");
}

// ---- Banks ------------------------------------------------------------------------------

export async function createBank(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await requireMenuItem("/master/banks");
  const parsed = bankSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  const write = await audit(member, "master.bank_created", parsed.data.bankName);

  const id = await withTransaction(async (tx) => {
    const created = await insertBank(tx, parsed.data);
    if (created) await write(tx);
    return created;
  });
  if (!id) return fail("An active bank already has this name.", "conflict", { bankName: "Already in the list" });
  refresh();
  return done(`${parsed.data.bankName} added.`);
}

export async function saveBank(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await requireMenuItem("/master/banks");
  const parsed = updateBankSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  const { bankId, ...fields } = parsed.data;
  const write = await audit(member, "master.bank_updated", fields.bankName, fields.isActive ? null : "Deactivated");

  const outcome = await withTransaction(async (tx) => {
    const result = await updateBank(tx, bankId, fields);
    if (result === "saved") await write(tx);
    return result;
  });
  return saved(outcome, "Bank", "Another active bank has this name.");
}

// ---- Clearing agents --------------------------------------------------------------------

export async function createAgent(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await requireMenuItem("/master/agents/new");
  const parsed = agentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  const write = await audit(member, "master.agent_created", parsed.data.agentName);

  const id = await withTransaction(async (tx) => {
    const created = await insertAgent(tx, parsed.data);
    if (created) await write(tx);
    return created;
  });
  if (!id) return fail("An active clearing agent already has this name.", "conflict", { agentName: "Already in the list" });
  // As in old DigiDocs: back to the list after adding.
  redirect(`/master/agents?added=${encodeURIComponent(parsed.data.agentName)}`);
}

export async function saveAgent(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await requireMenuItem("/master/agents");
  const parsed = updateAgentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  const { agentId, ...fields } = parsed.data;
  const write = await audit(member, "master.agent_updated", fields.agentName, fields.isActive ? null : "Deactivated");

  const outcome = await withTransaction(async (tx) => {
    const result = await updateAgent(tx, agentId, fields);
    if (result === "saved") await write(tx);
    return result;
  });
  return saved(outcome, "Clearing agent", "Another active clearing agent has this name.");
}

// ---- Ports ------------------------------------------------------------------------------

export async function createPort(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await requireMenuItem("/master/ports");
  const parsed = portSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  const label = `${parsed.data.portName} (${PORT_KIND_LABELS[parsed.data.portKind]})`;
  const write = await audit(member, "master.port_created", label);

  const id = await withTransaction(async (tx) => {
    const created = await insertPort(tx, parsed.data);
    if (created) await write(tx);
    return created;
  });
  if (!id) return fail("An active port of this kind already has this name.", "conflict", { portName: "Already in the list" });
  refresh();
  return done(`${label} added.`);
}

export async function savePort(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const member = await requireMenuItem("/master/ports");
  const parsed = updatePortSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalidInput(parsed.error);
  const { portId, ...fields } = parsed.data;
  const label = `${fields.portName} (${PORT_KIND_LABELS[fields.portKind]})`;
  const write = await audit(member, "master.port_updated", label, fields.isActive ? null : "Deactivated");

  const outcome = await withTransaction(async (tx) => {
    const result = await updatePort(tx, portId, fields);
    if (result === "saved") await write(tx);
    return result;
  });
  return saved(outcome, "Port", "Another active port of this kind has this name.");
}

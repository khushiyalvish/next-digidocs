import "server-only";
import type { Db } from "@/lib/db";
import type { AgentFields, BankFields, PortFields } from "@/features/masters/schemas";

/*
 * The only writer of dbo.banks, dbo.clearing_agents and dbo.ports (rows from migration 0004 and
 * those LFZ Admins add). A duplicate is refused in the same statement that writes, so two people
 * saving at once cannot both create one: an ACTIVE row with the same name (for ports: the same
 * name and kind) blocks it. Names compare in the database's collation (case-insensitive).
 * Nothing is deleted: "remove" is deactivate, as in old DigiDocs.
 */

export type SaveOutcome = "saved" | "duplicate" | "not_found";

export async function insertBank(db: Db, fields: BankFields): Promise<string | null> {
  const [row] = await db.query<{ id: string }>`
    INSERT INTO dbo.banks (bank_name)
    OUTPUT inserted.id
    SELECT ${fields.bankName}
    WHERE NOT EXISTS (SELECT 1 FROM dbo.banks WHERE bank_name = ${fields.bankName} AND is_active = 1)`;
  return row ? row.id.toLowerCase() : null;
}

export async function updateBank(db: Db, id: string, fields: BankFields & { isActive: boolean }): Promise<SaveOutcome> {
  const rows = await db.query`
    UPDATE dbo.banks SET bank_name = ${fields.bankName}, is_active = ${fields.isActive}
    OUTPUT inserted.id
    WHERE id = ${id}
      AND NOT (${fields.isActive} = 1 AND EXISTS (
        SELECT 1 FROM dbo.banks other WHERE other.id <> ${id} AND other.bank_name = ${fields.bankName} AND other.is_active = 1))`;
  if (rows.length > 0) return "saved";
  return (await db.query`SELECT 1 AS found FROM dbo.banks WHERE id = ${id}`).length > 0 ? "duplicate" : "not_found";
}

export async function insertAgent(db: Db, fields: AgentFields): Promise<string | null> {
  const [row] = await db.query<{ id: string }>`
    INSERT INTO dbo.clearing_agents (agent_name, email, phone_number)
    OUTPUT inserted.id
    SELECT ${fields.agentName}, ${fields.email}, ${fields.phoneNumber}
    WHERE NOT EXISTS (SELECT 1 FROM dbo.clearing_agents WHERE agent_name = ${fields.agentName} AND is_active = 1)`;
  return row ? row.id.toLowerCase() : null;
}

export async function updateAgent(db: Db, id: string, fields: AgentFields & { isActive: boolean }): Promise<SaveOutcome> {
  const rows = await db.query`
    UPDATE dbo.clearing_agents
    SET agent_name = ${fields.agentName}, email = ${fields.email}, phone_number = ${fields.phoneNumber}, is_active = ${fields.isActive}
    OUTPUT inserted.id
    WHERE id = ${id}
      AND NOT (${fields.isActive} = 1 AND EXISTS (
        SELECT 1 FROM dbo.clearing_agents other WHERE other.id <> ${id} AND other.agent_name = ${fields.agentName} AND other.is_active = 1))`;
  if (rows.length > 0) return "saved";
  return (await db.query`SELECT 1 AS found FROM dbo.clearing_agents WHERE id = ${id}`).length > 0 ? "duplicate" : "not_found";
}

export async function insertPort(db: Db, fields: PortFields): Promise<string | null> {
  const [row] = await db.query<{ id: string }>`
    INSERT INTO dbo.ports (port_name, port_kind)
    OUTPUT inserted.id
    SELECT ${fields.portName}, ${fields.portKind}
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ports WHERE port_name = ${fields.portName} AND port_kind = ${fields.portKind} AND is_active = 1)`;
  return row ? row.id.toLowerCase() : null;
}

export async function updatePort(db: Db, id: string, fields: PortFields & { isActive: boolean }): Promise<SaveOutcome> {
  const rows = await db.query`
    UPDATE dbo.ports SET port_name = ${fields.portName}, port_kind = ${fields.portKind}, is_active = ${fields.isActive}
    OUTPUT inserted.id
    WHERE id = ${id}
      AND NOT (${fields.isActive} = 1 AND EXISTS (
        SELECT 1 FROM dbo.ports other
        WHERE other.id <> ${id} AND other.port_name = ${fields.portName} AND other.port_kind = ${fields.portKind} AND other.is_active = 1))`;
  if (rows.length > 0) return "saved";
  return (await db.query`SELECT 1 AS found FROM dbo.ports WHERE id = ${id}`).length > 0 ? "duplicate" : "not_found";
}

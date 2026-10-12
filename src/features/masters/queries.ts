import "server-only";
import { db } from "@/lib/db";
import { containsPattern } from "@/lib/sql-text";
import type { MasterListFilter, PortKind } from "@/features/masters/schemas";

/*
 * Reads of the Master lists: banks, clearing agents, ports. Callers are LFZ Admins (the Master
 * menu); nothing here is personal or scoped.
 */

export const MASTERS_PAGE_SIZE = 50;

export interface BankDto {
  id: string;
  bankName: string;
  isActive: boolean;
}

export async function listBanks(): Promise<BankDto[]> {
  const rows = await db.query<{ id: string; bank_name: string; is_active: boolean }>`
    SELECT id, bank_name, is_active FROM dbo.banks ORDER BY is_active DESC, bank_name`;
  return rows.map((row) => ({ id: row.id.toLowerCase(), bankName: row.bank_name, isActive: row.is_active }));
}

export async function getBank(id: string): Promise<BankDto | null> {
  const [row] = await db.query<{ id: string; bank_name: string; is_active: boolean }>`
    SELECT id, bank_name, is_active FROM dbo.banks WHERE id = ${id}`;
  return row ? { id: row.id.toLowerCase(), bankName: row.bank_name, isActive: row.is_active } : null;
}

export interface AgentDto {
  id: string;
  agentName: string;
  email: string | null;
  phoneNumber: string | null;
  isActive: boolean;
}

type AgentRow = { id: string; agent_name: string; email: string | null; phone_number: string | null; is_active: boolean };
const toAgent = (row: AgentRow): AgentDto => ({
  id: row.id.toLowerCase(),
  agentName: row.agent_name,
  email: row.email,
  phoneNumber: row.phone_number,
  isActive: row.is_active,
});

export async function listAgents(filter: MasterListFilter): Promise<{ agents: AgentDto[]; total: number }> {
  const pattern = containsPattern(filter.q);
  const status = filter.status ?? null;
  const offset = (filter.page - 1) * MASTERS_PAGE_SIZE;
  const rows = await db.query<AgentRow & { total: number }>`
    SELECT id, agent_name, email, phone_number, is_active, COUNT(*) OVER () AS total
    FROM dbo.clearing_agents
    WHERE (${pattern} IS NULL OR agent_name LIKE ${pattern} ESCAPE '\\' OR email LIKE ${pattern} ESCAPE '\\' OR phone_number LIKE ${pattern} ESCAPE '\\')
      AND (${status} IS NULL OR (${status} = 'active' AND is_active = 1) OR (${status} = 'inactive' AND is_active = 0))
    ORDER BY is_active DESC, agent_name
    OFFSET ${offset} ROWS FETCH NEXT ${MASTERS_PAGE_SIZE} ROWS ONLY`;
  return { total: rows[0]?.total ?? 0, agents: rows.map(toAgent) };
}

export async function getAgent(id: string): Promise<AgentDto | null> {
  const [row] = await db.query<AgentRow>`
    SELECT id, agent_name, email, phone_number, is_active FROM dbo.clearing_agents WHERE id = ${id}`;
  return row ? toAgent(row) : null;
}

export interface PortDto {
  id: string;
  portName: string;
  portKind: PortKind;
  isActive: boolean;
}

type PortRow = { id: string; port_name: string; port_kind: PortKind; is_active: boolean };
const toPort = (row: PortRow): PortDto => ({
  id: row.id.toLowerCase(),
  portName: row.port_name,
  portKind: row.port_kind,
  isActive: row.is_active,
});

export async function listPorts(filter: MasterListFilter): Promise<{ ports: PortDto[]; total: number }> {
  const pattern = containsPattern(filter.q);
  const status = filter.status ?? null;
  const kind = filter.kind ?? null;
  const offset = (filter.page - 1) * MASTERS_PAGE_SIZE;
  const rows = await db.query<PortRow & { total: number }>`
    SELECT id, port_name, port_kind, is_active, COUNT(*) OVER () AS total
    FROM dbo.ports
    WHERE (${pattern} IS NULL OR port_name LIKE ${pattern} ESCAPE '\\')
      AND (${kind} IS NULL OR port_kind = ${kind})
      AND (${status} IS NULL OR (${status} = 'active' AND is_active = 1) OR (${status} = 'inactive' AND is_active = 0))
    ORDER BY is_active DESC, port_name, port_kind
    OFFSET ${offset} ROWS FETCH NEXT ${MASTERS_PAGE_SIZE} ROWS ONLY`;
  return { total: rows[0]?.total ?? 0, ports: rows.map(toPort) };
}

export async function getPort(id: string): Promise<PortDto | null> {
  const [row] = await db.query<PortRow>`SELECT id, port_name, port_kind, is_active FROM dbo.ports WHERE id = ${id}`;
  return row ? toPort(row) : null;
}

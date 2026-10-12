import "server-only";
import { db } from "@/lib/db";
import { containsPattern, escapeLike } from "@/lib/sql-text";

/*
 * Reads of the reference lists (migrations 0004 and 0005). Fixed data: no writer in the app — a
 * change is a new migration (decision log 2026-10-08). Nothing here is personal or scoped: every
 * member may read it; the page that shows it is for LFZ Admins.
 */

export interface ReferenceCountDto {
  key: string;
  label: string;
  total: number;
  active: number;
}

/** How many rows each list has, for the Reference data page. */
export async function countReferenceLists(): Promise<ReferenceCountDto[]> {
  const rows = await db.query<{ list_key: string; total: number; active: number }>`
    SELECT 'hse' AS list_key, COUNT(*) AS total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active FROM dbo.hse_codes
    UNION ALL SELECT 'countries', COUNT(*), SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) FROM dbo.countries
    UNION ALL SELECT 'currencies', COUNT(*), SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) FROM dbo.currencies
    UNION ALL SELECT 'states', COUNT(*), SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) FROM dbo.nigerian_states
    UNION ALL SELECT 'zones', COUNT(*), SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) FROM dbo.free_zones
    UNION ALL SELECT 'ports', COUNT(*), SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) FROM dbo.ports
    UNION ALL SELECT 'units', COUNT(*), SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) FROM dbo.measurement_units
    UNION ALL SELECT 'documents', COUNT(*), SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) FROM dbo.document_types
    UNION ALL SELECT 'transactions', COUNT(*), SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) FROM dbo.transaction_types
    UNION ALL SELECT 'agents', COUNT(*), SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) FROM dbo.clearing_agents
    UNION ALL SELECT 'banks', COUNT(*), SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) FROM dbo.banks`;

  const labels: Record<string, string> = {
    hse: "HSE codes",
    countries: "Countries",
    currencies: "Currencies",
    states: "Nigerian states",
    zones: "Free zones",
    ports: "Ports",
    units: "Units of measurement",
    documents: "Document types",
    transactions: "Transaction types",
    agents: "Clearing agents",
    banks: "Banks",
  };
  return rows.map((row) => ({ key: row.list_key, label: labels[row.list_key], total: row.total, active: row.active ?? 0 }));
}

export const HSE_PAGE_SIZE = 50;

export interface HseCodeDto {
  id: string;
  hseCode: string;
  goodsDescription: string | null;
  importDutyRate: number;
  levyRate: number;
  exciseRate: number;
  vatRate: number;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
}

/** HSE codes whose code starts with, or whose description contains, the search text. */
export async function searchHseCodes(filter: { q?: string; page: number }): Promise<{ codes: HseCodeDto[]; total: number }> {
  const contains = containsPattern(filter.q);
  const startsWith = filter.q ? `${escapeLike(filter.q)}%` : null;
  const offset = (filter.page - 1) * HSE_PAGE_SIZE;

  const rows = await db.query<{
    id: string;
    hse_code: string;
    goods_description: string | null;
    import_duty_rate: number;
    levy_rate: number;
    excise_rate: number;
    vat_rate: number;
    valid_from: string | null;
    valid_to: string | null;
    is_active: boolean;
    total: number;
  }>`
    SELECT id, hse_code, goods_description, import_duty_rate, levy_rate, excise_rate, vat_rate, is_active,
           CONVERT(CHAR(10), valid_from, 23) AS valid_from, CONVERT(CHAR(10), valid_to, 23) AS valid_to,
           COUNT(*) OVER () AS total
    FROM dbo.hse_codes
    WHERE ${contains} IS NULL
       OR hse_code LIKE ${startsWith} ESCAPE '\\'
       OR goods_description LIKE ${contains} ESCAPE '\\'
    ORDER BY hse_code
    OFFSET ${offset} ROWS FETCH NEXT ${HSE_PAGE_SIZE} ROWS ONLY`;

  return {
    total: rows[0]?.total ?? 0,
    codes: rows.map((row) => ({
      id: row.id.toLowerCase(),
      hseCode: row.hse_code,
      goodsDescription: row.goods_description,
      importDutyRate: Number(row.import_duty_rate),
      levyRate: Number(row.levy_rate),
      exciseRate: Number(row.excise_rate),
      vatRate: Number(row.vat_rate),
      validFrom: row.valid_from,
      validTo: row.valid_to,
      isActive: row.is_active,
    })),
  };
}

export interface OptionDto {
  id: string;
  label: string;
}

/** The active transaction types, imports first, for choices such as the dashboard's filter. */
export async function listTransactionTypeOptions(): Promise<(OptionDto & { direction: "import" | "export" })[]> {
  const rows = await db.query<{ id: string; transaction_name: string; direction: "import" | "export" }>`
    SELECT id, transaction_name, direction
    FROM dbo.transaction_types
    WHERE is_active = 1
    ORDER BY direction DESC, transaction_name`;
  return rows.map((row) => ({ id: row.id.toLowerCase(), label: row.transaction_name, direction: row.direction }));
}

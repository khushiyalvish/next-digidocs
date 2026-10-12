import "server-only";
import { db, type Db } from "@/lib/db";
import { containsPattern } from "@/lib/sql-text";

/*
 * Reads of dbo.organisations. Callers are LFZ Admins (requireRole("lfz_admin")), who may see
 * every organisation. "Licence expired" is decided by the database's date, never the server's.
 */

export const ORGANISATIONS_PAGE_SIZE = 50;

export interface OrganisationListItemDto {
  id: string;
  companyName: string;
  shortCode: string;
  licenceNumber: string | null;
  licenceExpiresOn: string | null;
  isLicenceExpired: boolean;
  isActive: boolean;
  userCount: number;
}

export async function listOrganisations(filter: {
  q?: string;
  status?: "active" | "inactive" | "licence-expired";
  page: number;
}): Promise<{ organisations: OrganisationListItemDto[]; total: number }> {
  const pattern = containsPattern(filter.q);
  const status = filter.status ?? null;
  const offset = (filter.page - 1) * ORGANISATIONS_PAGE_SIZE;

  const rows = await db.query<{
    id: string;
    company_name: string;
    short_code: string;
    licence_number: string | null;
    licence_expires_on: string | null;
    is_licence_expired: number;
    is_active: boolean;
    user_count: number;
    total: number;
  }>`
    WITH listed AS (
      SELECT o.id, o.company_name, o.short_code, o.licence_number, o.is_active,
             CONVERT(CHAR(10), o.licence_expires_on, 23) AS licence_expires_on,
             CASE WHEN o.licence_expires_on < CAST(SYSDATETIMEOFFSET() AS DATE) THEN 1 ELSE 0 END AS is_licence_expired,
             (SELECT COUNT(*) FROM dbo.user_accounts u WHERE u.organisation_id = o.id) AS user_count
      FROM dbo.organisations o
      WHERE (${pattern} IS NULL
             OR o.company_name LIKE ${pattern} ESCAPE '\\'
             OR o.short_code LIKE ${pattern} ESCAPE '\\'
             OR o.registration_number LIKE ${pattern} ESCAPE '\\')
    )
    SELECT *, COUNT(*) OVER () AS total
    FROM listed
    WHERE ${status} IS NULL
       OR (${status} = 'active' AND is_active = 1)
       OR (${status} = 'inactive' AND is_active = 0)
       OR (${status} = 'licence-expired' AND is_active = 1 AND is_licence_expired = 1)
    ORDER BY company_name, short_code
    OFFSET ${offset} ROWS FETCH NEXT ${ORGANISATIONS_PAGE_SIZE} ROWS ONLY`;

  return {
    total: rows[0]?.total ?? 0,
    organisations: rows.map((row) => ({
      id: row.id.toLowerCase(),
      companyName: row.company_name,
      shortCode: row.short_code,
      licenceNumber: row.licence_number,
      licenceExpiresOn: row.licence_expires_on,
      isLicenceExpired: row.is_licence_expired === 1,
      isActive: row.is_active,
      userCount: row.user_count,
    })),
  };
}

export interface OrganisationDetailDto {
  id: string;
  companyName: string;
  shortCode: string;
  orionCode: string | null;
  registrationNumber: string | null;
  registrationDate: string | null;
  licenceNumber: string | null;
  licenceExpiresOn: string | null;
  isLicenceExpired: boolean;
  isActive: boolean;
  userCount: number;
  createdAt: string;
}

export async function getOrganisation(id: string): Promise<OrganisationDetailDto | null> {
  const [row] = await db.query<{
    id: string;
    company_name: string;
    short_code: string;
    orion_code: string | null;
    registration_number: string | null;
    registration_date: string | null;
    licence_number: string | null;
    licence_expires_on: string | null;
    is_licence_expired: number;
    is_active: boolean;
    user_count: number;
    created_at: Date;
  }>`
    SELECT o.id, o.company_name, o.short_code, o.orion_code, o.registration_number, o.licence_number,
           o.is_active, o.created_at,
           CONVERT(CHAR(10), o.registration_date, 23) AS registration_date,
           CONVERT(CHAR(10), o.licence_expires_on, 23) AS licence_expires_on,
           CASE WHEN o.licence_expires_on < CAST(SYSDATETIMEOFFSET() AS DATE) THEN 1 ELSE 0 END AS is_licence_expired,
           (SELECT COUNT(*) FROM dbo.user_accounts u WHERE u.organisation_id = o.id) AS user_count
    FROM dbo.organisations o
    WHERE o.id = ${id}`;
  if (!row) return null;

  return {
    id: row.id.toLowerCase(),
    companyName: row.company_name,
    shortCode: row.short_code,
    orionCode: row.orion_code,
    registrationNumber: row.registration_number,
    registrationDate: row.registration_date,
    licenceNumber: row.licence_number,
    licenceExpiresOn: row.licence_expires_on,
    isLicenceExpired: row.is_licence_expired === 1,
    isActive: row.is_active,
    userCount: row.user_count,
    createdAt: row.created_at.toISOString(),
  };
}

export interface OrganisationOptionDto {
  id: string;
  label: string;
  isActive: boolean;
}

/** Every organisation, for the "Organisation" choice on a user (inactive ones are marked). */
export async function listOrganisationOptions(): Promise<OrganisationOptionDto[]> {
  const rows = await db.query<{ id: string; company_name: string; short_code: string; is_active: boolean }>`
    SELECT id, company_name, short_code, is_active
    FROM dbo.organisations
    ORDER BY company_name, short_code`;
  return rows.map((row) => ({
    id: row.id.toLowerCase(),
    label: `${row.company_name} (${row.short_code})`,
    isActive: row.is_active,
  }));
}

/**
 * The organisation with this short code, for the test-users seed. null when none — or more than
 * one — has it (short codes are not unique: the old data has duplicates).
 */
export async function findOrganisationIdByShortCode(db: Db, shortCode: string): Promise<string | null> {
  const rows = await db.query<{ id: string }>`SELECT id FROM dbo.organisations WHERE short_code = ${shortCode}`;
  return rows.length === 1 ? rows[0].id.toLowerCase() : null;
}

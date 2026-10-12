import "server-only";
import type { Db } from "@/lib/db";
import type { OrganisationFields } from "@/features/organisations/schemas";

/* The only writer of dbo.organisations (ARCHITECTURE.md §2). */

export async function insertOrganisation(db: Db, fields: OrganisationFields): Promise<string> {
  const [row] = await db.query<{ id: string }>`
    INSERT INTO dbo.organisations
      (company_name, short_code, orion_code, registration_number, registration_date, licence_number, licence_expires_on)
    OUTPUT inserted.id
    VALUES (${fields.companyName}, ${fields.shortCode}, ${fields.orionCode}, ${fields.registrationNumber},
            ${fields.registrationDate}, ${fields.licenceNumber}, ${fields.licenceExpiresOn})`;
  return row.id.toLowerCase();
}

/** False: no such organisation. */
export async function updateOrganisation(
  db: Db,
  id: string,
  fields: OrganisationFields & { isActive: boolean },
): Promise<boolean> {
  const rows = await db.query`
    UPDATE dbo.organisations
    SET company_name = ${fields.companyName}, short_code = ${fields.shortCode}, orion_code = ${fields.orionCode},
        registration_number = ${fields.registrationNumber}, registration_date = ${fields.registrationDate},
        licence_number = ${fields.licenceNumber}, licence_expires_on = ${fields.licenceExpiresOn},
        is_active = ${fields.isActive}, updated_at = SYSDATETIMEOFFSET()
    OUTPUT inserted.id
    WHERE id = ${id}`;
  return rows.length > 0;
}

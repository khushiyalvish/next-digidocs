import { NextResponse, type NextRequest } from "next/server";
import { idSchema } from "@/lib/schemas";
import { requireMember } from "@/features/auth/guards";
import { buildCombinedPdf, type CombinedFile } from "@/features/imports/combined-pdf";
import { readImportFile } from "@/features/imports/document-storage";
import { getImport, getImportView, listImportDocuments, listImportStoredFiles } from "@/features/imports/queries";
import { LETTER_KINDS } from "@/features/workflow/review";
import { STATUS_LABELS } from "@/features/workflow/statuses";

/**
 * GET /api/imports/<id>/combined-pdf — "Download Document": every file of an import (its
 * documents, the Duty Paid File, the review letters) in one PDF named after the tracking number
 * (features/imports/combined-pdf.ts). For whoever may see the import in their list (the list's
 * scope), as the single-file download; anything else 404.
 */
export async function GET(_request: NextRequest, context: RouteContext<"/api/imports/[id]/combined-pdf">) {
  const member = await requireMember();
  const importId = idSchema.safeParse((await context.params).id);
  const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  if (!importId.success || !(await getImport(member, importId.data))) return notFound();

  const [view, documents, stored] = await Promise.all([getImportView(importId.data), listImportDocuments(importId.data), listImportStoredFiles(importId.data)]);
  if (!view) return notFound();

  // The page's order: the Particular's documents, the Duty Paid File, then the letters.
  const listed = [
    ...documents.slots.flatMap((slot) => slot.files.map((file) => ({ label: slot.name, file }))),
    ...documents.dutyFiles.map((file) => ({ label: "Duty Paid File", file })),
    ...documents.letters.flatMap((letter) => letter.files.map((file) => ({ label: LETTER_KINDS[letter.kind], file }))),
  ];
  const files: CombinedFile[] = await Promise.all(
    listed.map(async ({ label, file }) => {
      const where = stored.get(file.id);
      const bytes = where ? await readImportFile(importId.data, where.storedName).catch(() => null) : null;
      return { label, name: file.name, contentType: where?.contentType ?? "", bytes: bytes ? new Uint8Array(bytes) : null };
    }),
  );

  const tracking = view.trackingNumber ?? "import";
  const pdf = await buildCombinedPdf({
    heading: `Documents of import ${tracking}`,
    details: [`${view.particular.name} · ${view.enterprise.name} (${view.enterprise.code})`, `Status: ${STATUS_LABELS[view.status]}`],
    files,
  });

  const fileName = `${tracking.replace(/[^A-Za-z0-9._-]+/g, "-")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.byteLength),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

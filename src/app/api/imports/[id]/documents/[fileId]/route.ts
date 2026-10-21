import { NextResponse, type NextRequest } from "next/server";
import { idSchema } from "@/lib/schemas";
import { requireMember } from "@/features/auth/guards";
import { readImportFile } from "@/features/imports/document-storage";
import { getImport, getImportDocumentFile } from "@/features/imports/queries";

/**
 * GET /api/imports/<id>/documents/<file id> — one uploaded file of an import, for anyone who may
 * see the import in their list (the list's scope: role's statuses; an Enterprise user, their own
 * organisation's). Anything else, or a file missing from the folder, is 404. PDFs and images open
 * in the browser; ZIP and TIFF download.
 */

const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif"]);

export async function GET(_request: NextRequest, context: RouteContext<"/api/imports/[id]/documents/[fileId]">) {
  const member = await requireMember();
  const params = await context.params;
  const importId = idSchema.safeParse(params.id);
  const fileId = idSchema.safeParse(params.fileId);
  const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  if (!importId.success || !fileId.success) return notFound();

  if (!(await getImport(member, importId.data))) return notFound();
  const file = await getImportDocumentFile(importId.data, fileId.data);
  if (!file) return notFound();

  let bytes: Buffer;
  try {
    bytes = await readImportFile(importId.data, file.storedName);
  } catch {
    return notFound();
  }

  const disposition = INLINE.has(file.contentType) ? "inline" : "attachment";
  const asciiName = file.originalName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

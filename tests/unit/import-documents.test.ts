import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkDocumentFile, cleanFileName, documentProblems, formatBytes, MAX_DOCUMENT_BYTES, sniffKind, type DocumentSlot } from "@/features/imports/documents";

/* Pins the import documents' rules (src/features/imports/documents.ts) and migration 0011. */

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const HTML = new TextEncoder().encode("<html><script>");

describe("which files may be uploaded", () => {
  it("knows the allowed kinds by their first bytes", () => {
    expect(sniffKind(PDF)).toBe("pdf");
    expect(sniffKind(PNG)).toBe("png");
    expect(sniffKind(JPEG)).toBe("jpeg");
    expect(sniffKind(ZIP)).toBe("zip");
    expect(sniffKind(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBe("gif");
    expect(sniffKind(new Uint8Array([0x49, 0x49, 0x2a, 0x00]))).toBe("tiff");
    expect(sniffKind(HTML)).toBeNull();
  });

  it("accepts the old extensions, in any case, when the content matches", () => {
    expect(checkDocumentFile({ name: "Bill of Lading.PDF", size: 1000, head: PDF })).toEqual({ ok: true, extension: "pdf", contentType: "application/pdf" });
    expect(checkDocumentFile({ name: "photo.jpg", size: 1000, head: JPEG })).toMatchObject({ ok: true, contentType: "image/jpeg" });
    expect(checkDocumentFile({ name: "photo.jpeg", size: 1000, head: JPEG })).toMatchObject({ ok: true });
    expect(checkDocumentFile({ name: "all.zip", size: 1000, head: ZIP })).toMatchObject({ ok: true });
  });

  it("refuses other extensions, a content that does not match, empty and oversized files", () => {
    expect(checkDocumentFile({ name: "invoice.docx", size: 1000, head: ZIP }).ok).toBe(false);
    expect(checkDocumentFile({ name: "page.html", size: 1000, head: HTML }).ok).toBe(false);
    expect(checkDocumentFile({ name: "fake.pdf", size: 1000, head: HTML })).toMatchObject({ ok: false, error: "The file's content is not a .pdf file." });
    expect(checkDocumentFile({ name: "renamed.png", size: 1000, head: PDF }).ok).toBe(false);
    expect(checkDocumentFile({ name: "empty.pdf", size: 0, head: PDF }).ok).toBe(false);
    expect(checkDocumentFile({ name: "big.pdf", size: MAX_DOCUMENT_BYTES + 1, head: PDF })).toMatchObject({ ok: false, error: "The file is larger than 5 MB." });
    expect(checkDocumentFile({ name: "exact.pdf", size: MAX_DOCUMENT_BYTES, head: PDF }).ok).toBe(true);
  });

  it("keeps the uploader's name only as a name: no folders, no control or reserved characters", () => {
    expect(cleanFileName("C:\\Users\\me\\Bill of Lading.pdf")).toBe("Bill of Lading.pdf");
    expect(cleanFileName("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(cleanFileName('in"voice<1>.pdf')).toBe("in_voice_1_.pdf");
    expect(cleanFileName("")).toBe("document");
    expect(cleanFileName(`${"a".repeat(300)}.pdf`)).toHaveLength(255);
  });

  it("shows sizes in KB or MB", () => {
    expect(formatBytes(340 * 1024)).toBe("340 KB");
    expect(formatBytes(1.25 * 1024 * 1024)).toBe("1.3 MB");
  });
});

describe("what Submit requires of the documents", () => {
  const file = { id: "f1", name: "a.pdf", sizeBytes: 10, uploadedAt: "2026-10-15T00:00:00.000Z" };
  const slots: DocumentSlot[] = [
    { documentTypeId: "d1", name: "Bill of Lading", required: true, multiple: false, files: [] },
    { documentTypeId: "d2", name: "Packing List", required: true, multiple: false, files: [file] },
    { documentTypeId: "d3", name: "Others", required: false, multiple: true, files: [] },
  ];

  it("names each required document without a file", () => {
    expect(documentProblems(slots, { shown: false, required: false, dutyPaid: null, files: [] })).toEqual({ "documents.d1": "Upload the Bill of Lading" });
  });

  it("asks for the Duty Paid File only when the Particular has it and the duty was paid", () => {
    expect(documentProblems([], { shown: true, required: true, dutyPaid: true, files: [] })).toEqual({ dutyPaidFile: "Upload the evidence of duty paid" });
    expect(documentProblems([], { shown: true, required: true, dutyPaid: false, files: [] })).toEqual({});
    expect(documentProblems([], { shown: false, required: true, dutyPaid: true, files: [] })).toEqual({});
    expect(documentProblems([], { shown: true, required: true, dutyPaid: true, files: [file] })).toEqual({});
  });
});

describe("migration 0011", () => {
  const sql = readFileSync(join(process.cwd(), "database", "migrations", "0011_import_documents.sql"), "utf8");

  it("moves the six Others links from 44 to 48 and checks it did", () => {
    expect(sql).toContain("INSERT INTO dbo.document_types (legacy_id, document_name, is_active) VALUES (48, N'Others', 1);");
    expect(sql).toContain("UPDATE dbo.document_types SET is_active = 0 WHERE legacy_id = 44;");
    expect(sql).toMatch(/WHERE d\.legacy_id = 48\) <> 6/);
  });

  it("keeps a document's type and its purpose consistent, and stored names unique", () => {
    expect(sql).toContain("(purpose = 'document' AND document_type_id IS NOT NULL) OR (purpose = 'duty_paid' AND document_type_id IS NULL)");
    expect(sql).toContain("CONSTRAINT ux_import_documents_stored_name UNIQUE (stored_name)");
    expect(sql).toContain("REFERENCES dbo.imports (id) ON DELETE CASCADE");
  });
});

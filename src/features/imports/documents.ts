/*
 * The documents of an import (old _EnterpriseDocsPartial; decision log 2026-10-15): which files
 * may be uploaded, how a file's real type is told from its first bytes, and which documents
 * Submit requires.
 *
 *   - One file per document; "Others" (old id 48) takes several.
 *   - .png .pdf .jpeg .jpg .zip .gif .tiff, at most 5 MB each (old UploadFileValidation.js).
 *   - The name is not restricted (old: no spaces or special characters): files are stored under a
 *     generated name, the uploader's name is only shown.
 *   - A file whose content is not what its extension says is refused.
 *
 * Pure: no database, no file system.
 */

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/** The old document id of "Others", the one document that takes several files. */
export const OTHERS_DOCUMENT_LEGACY_ID = 48;

/** Allowed extensions, the content type they are served with, and the kind of content they must hold. */
export const DOCUMENT_TYPES = {
  pdf: { contentType: "application/pdf", kind: "pdf" },
  png: { contentType: "image/png", kind: "png" },
  jpg: { contentType: "image/jpeg", kind: "jpeg" },
  jpeg: { contentType: "image/jpeg", kind: "jpeg" },
  gif: { contentType: "image/gif", kind: "gif" },
  tif: { contentType: "image/tiff", kind: "tiff" },
  tiff: { contentType: "image/tiff", kind: "tiff" },
  zip: { contentType: "application/zip", kind: "zip" },
} as const;

export type DocumentExtension = keyof typeof DOCUMENT_TYPES;

/** What the file chooser offers. */
export const DOCUMENT_ACCEPT = ".png,.pdf,.jpeg,.jpg,.zip,.gif,.tif,.tiff";

export const DOCUMENT_RULES_TEXT = "PDF, PNG, JPEG, GIF, TIFF or ZIP, at most 5 MB";

function extensionOf(fileName: string): DocumentExtension | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  const extension = match?.[1].toLowerCase();
  return extension && extension in DOCUMENT_TYPES ? (extension as DocumentExtension) : null;
}

/** The kind of content the first bytes show, or null when none of the allowed ones. */
export function sniffKind(head: Uint8Array): (typeof DOCUMENT_TYPES)[DocumentExtension]["kind"] | null {
  const starts = (...bytes: number[]) => bytes.every((byte, index) => head[index] === byte);
  if (starts(0x25, 0x50, 0x44, 0x46)) return "pdf"; // %PDF
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (starts(0xff, 0xd8, 0xff)) return "jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "gif"; // GIF8
  if (starts(0x49, 0x49, 0x2a, 0x00) || starts(0x4d, 0x4d, 0x00, 0x2a)) return "tiff";
  if (starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06)) return "zip"; // PK (empty archives too)
  return null;
}

export type FileCheck = { ok: true; extension: DocumentExtension; contentType: string } | { ok: false; error: string };

/** Whether an uploaded file may be kept: its size, its extension, and that its content matches. */
export function checkDocumentFile(file: { name: string; size: number; head: Uint8Array }): FileCheck {
  if (file.size <= 0) return { ok: false, error: "The file is empty." };
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, error: "The file is larger than 5 MB." };
  const extension = extensionOf(file.name);
  if (!extension) return { ok: false, error: `Only ${DOCUMENT_RULES_TEXT}.` };
  if (sniffKind(file.head) !== DOCUMENT_TYPES[extension].kind) {
    return { ok: false, error: `The file's content is not a .${extension} file.` };
  }
  return { ok: true, extension, contentType: DOCUMENT_TYPES[extension].contentType };
}

/** The uploader's file name, made safe to show and to name a download with (at most 255 characters). */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "_").trim();
  return (cleaned || "document").slice(-255);
}

/** A document of the import's Particular, with what has been uploaded for it. */
export interface DocumentSlot {
  documentTypeId: string;
  name: string;
  required: boolean;
  /** "Others": several files. */
  multiple: boolean;
  files: UploadedFile[];
}

export interface UploadedFile {
  id: string;
  name: string;
  sizeBytes: number;
  uploadedAt: string;
}

/**
 * Documents that block Submit: a required document without a file, and the Duty Paid File when
 * the Particular asks for it and the duty was paid. Keys are the form's field paths.
 */
export function documentProblems(
  slots: readonly DocumentSlot[],
  duty: { shown: boolean; required: boolean; dutyPaid: boolean | null; files: readonly UploadedFile[] },
): Record<string, string> {
  const problems: Record<string, string> = {};
  for (const slot of slots) {
    if (slot.required && slot.files.length === 0) problems[`documents.${slot.documentTypeId}`] = `Upload the ${slot.name}`;
  }
  if (duty.shown && duty.required && duty.dutyPaid === true && duty.files.length === 0) problems.dutyPaidFile = "Upload the evidence of duty paid";
  return problems;
}

/** "1.2 MB", "340 KB". */
export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

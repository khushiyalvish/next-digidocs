"use client";

import { useId, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, Trash2, Upload } from "lucide-react";
import { useFormState } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Badge, Card, CardBody } from "@/components/ui/primitives";
import { removeImportDocument } from "@/features/imports/actions";
import { DOCUMENT_ACCEPT, DOCUMENT_RULES_TEXT, formatBytes, type DocumentSlot, type UploadedFile } from "@/features/imports/documents";
import type { Result } from "@/lib/result";

/*
 * The import's documents (old _EnterpriseDocsPartial): each document of the Particular with its
 * file, uploaded at once when chosen (POST /api/imports/<id>/documents), "Upload to all" for one
 * file to every one-file document, and the key information's Duty Paid File. Files stay with the
 * draft whether or not the form is saved afterwards; Submit checks that the required ones exist.
 */

export type ImportDocuments = { slots: DocumentSlot[]; dutyFiles: UploadedFile[] };
type Target = string; // a document type id, "all" or "duty_paid"

/** The documents' state and the two things that change it. One per form: the Duty Paid File shares it. */
export function useImportDocuments(importId: string, initial: ImportDocuments) {
  const [documents, setDocuments] = useState(initial);
  const [busy, setBusy] = useState<Target | null>(null);
  const [errors, setErrors] = useState<Record<Target, string>>({});

  function finish(target: Target, result: Result<ImportDocuments>) {
    if (result.ok) {
      setDocuments(result.data);
      setErrors((current) => ({ ...current, [target]: "" }));
    } else {
      setErrors((current) => ({ ...current, [target]: result.error }));
    }
  }

  async function upload(target: Target, file: File) {
    setBusy(target);
    try {
      const body = new FormData();
      body.set("target", target);
      body.set("file", file);
      const response = await fetch(`/api/imports/${importId}/documents`, { method: "POST", body });
      const result = (await response.json().catch(() => null)) as Result<ImportDocuments> | null;
      finish(target, result ?? { ok: false, error: response.status === 413 ? "The file is larger than 5 MB." : "The upload failed. Try again." });
    } catch {
      finish(target, { ok: false, error: "The upload failed: check the connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  async function remove(target: Target, fileId: string) {
    setBusy(target);
    try {
      const body = new FormData();
      body.set("importId", importId);
      body.set("fileId", fileId);
      finish(target, await removeImportDocument(null, body));
    } finally {
      setBusy(null);
    }
  }

  return { documents, busy, errors, upload, remove };
}

type DocumentsState = ReturnType<typeof useImportDocuments>;

/** The link that opens or downloads an uploaded file. */
function FileLink({ importId, file }: { importId: string; file: UploadedFile }) {
  return (
    <a href={`/api/imports/${importId}/documents/${file.id}`} target="_blank" rel="noopener" className="font-medium wrap-anywhere text-primary underline-offset-2 hover:underline">
      {file.name}
      <span className="ml-1 text-xs font-normal text-muted">({formatBytes(file.sizeBytes)})</span>
    </a>
  );
}

/** "Upload" as a button that opens the file chooser; the file goes up as soon as it is chosen. */
function UploadButton({ label, disabled, busy, multiple, onFiles }: { label: string; disabled: boolean; busy: boolean; multiple?: boolean; onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={DOCUMENT_ACCEPT}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = ""; // the same file may be chosen again
          if (files.length > 0) onFiles(files);
        }}
      />
      <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()} aria-label={label}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
        Upload
      </Button>
    </>
  );
}

/** The Duty Paid File, inside Key Information when the duty was paid. */
export function DutyPaidFile({ importId, state, label, required, error }: { importId: string; state: DocumentsState; label: string; required: boolean; error?: string }) {
  const files = state.documents.dutyFiles;
  const message = state.errors.duty_paid || error;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <UploadButton label={`Upload ${label}`} disabled={state.busy !== null} busy={state.busy === "duty_paid"} onFiles={([file]) => state.upload("duty_paid", file)} />
        {files.map((file) => (
          <span key={file.id} className="flex items-center gap-1 text-sm">
            <FileLink importId={importId} file={file} />
            <Button type="button" variant="ghost" size="sm" disabled={state.busy !== null} onClick={() => state.remove("duty_paid", file.id)} aria-label={`Remove ${file.name}`}>
              <Trash2 aria-hidden className="text-danger" />
            </Button>
          </span>
        ))}
      </div>
      <p className={cx("text-[0.8125rem]", message ? "text-danger" : "text-muted")}>{message || DOCUMENT_RULES_TEXT}</p>
    </div>
  );
}

/** The Particular's documents, with what the last Submit said was missing. */
export function DocumentsSection({ importId, state }: { importId: string; state: DocumentsState }) {
  const { result } = useFormState();
  const submitErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const { documents, busy, errors, upload, remove } = state;
  const [bulk, setBulk] = useState<File | null>(null);
  const bulkId = useId();
  const singles = documents.slots.filter((slot) => !slot.multiple);
  if (documents.slots.length === 0) return null;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-ink">Enterprise Documents</h2>
        <span className="text-[0.8125rem] text-muted">{DOCUMENT_RULES_TEXT} per file</span>
      </div>
      <CardBody className="space-y-4">
        {singles.length > 1 && (
          <div className="flex flex-col gap-2 rounded-field bg-subtle p-3 sm:flex-row sm:items-center">
            <label htmlFor={bulkId} className="text-sm font-medium text-ink">
              One file for every document
            </label>
            <input
              id={bulkId}
              type="file"
              accept={DOCUMENT_ACCEPT}
              onChange={(event) => setBulk(event.target.files?.[0] ?? null)}
              className="min-w-0 text-sm text-ink-soft file:mr-3 file:rounded-button file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
            />
            <Button type="button" size="sm" disabled={!bulk || busy !== null} onClick={() => bulk && upload("all", bulk)}>
              {busy === "all" ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
              Upload to all
            </Button>
            {errors.all && <p className="text-[0.8125rem] text-danger">{errors.all}</p>}
          </div>
        )}

        <ul className="divide-y divide-line-soft rounded-card border border-line">
          {documents.slots.map((slot) => {
            const message = errors[slot.documentTypeId] || submitErrors[`documents.${slot.documentTypeId}`];
            const uploaded = slot.files.length > 0;
            return (
              <li key={slot.documentTypeId} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-4">
                <div className="min-w-0 sm:w-72 sm:shrink-0">
                  <p className="text-sm font-medium wrap-anywhere text-ink">
                    {slot.name}
                    {slot.required && <span className="text-danger"> *</span>}
                  </p>
                  {slot.multiple && <p className="text-xs text-muted">Several files allowed</p>}
                </div>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  {uploaded ? (
                    slot.files.map((file) => (
                      <div key={file.id} className="flex items-center gap-1">
                        <FileLink importId={importId} file={file} />
                        <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => remove(slot.documentTypeId, file.id)} aria-label={`Remove ${file.name}`}>
                          <Trash2 aria-hidden className="text-danger" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <span className="text-muted">No file yet</span>
                  )}
                  {message && <p className="text-[0.8125rem] text-danger" data-field-error>{message}</p>}
                </div>
                <div className="flex items-center gap-2 sm:shrink-0">
                  <UploadButton
                    label={`Upload ${slot.name}`}
                    multiple={slot.multiple}
                    disabled={busy !== null}
                    busy={busy === slot.documentTypeId}
                    onFiles={async (files) => {
                      for (const file of slot.multiple ? files : files.slice(0, 1)) await upload(slot.documentTypeId, file);
                    }}
                  />
                  {uploaded ? (
                    <Badge tone="success">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Uploaded
                    </Badge>
                  ) : (
                    <Badge tone="neutral">
                      <Clock className="size-3.5" aria-hidden /> Pending
                    </Badge>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

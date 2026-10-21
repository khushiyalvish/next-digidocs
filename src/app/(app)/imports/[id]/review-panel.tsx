"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Alert, Card, CardBody, inputClasses } from "@/components/ui/primitives";
import { DOCUMENT_ACCEPT, DOCUMENT_RULES_TEXT, formatBytes } from "@/features/imports/documents";
import { LETTER_KINDS, MAX_REASON_LENGTH, type ReviewStep } from "@/features/workflow/review";
import type { Result } from "@/lib/result";

/*
 * The officer's part of the View page: the steps their role may take now (features/workflow/
 * review.ts), each asking in a popup for what it needs — the letter to upload, the reason for a
 * rejection — and sent to POST /api/imports/<id>/review, which checks everything again. After a
 * step the page reloads its data: the status, the timeline and the letters change.
 */

export function ReviewPanel({ importId, steps, intro }: { importId: string; steps: readonly ReviewStep[]; intro: string }) {
  const [done, setDone] = useState<string | null>(null);
  if (steps.length === 0 && !done) return null;
  return (
    <Card className="border-primary/40">
      <CardBody className="space-y-3">
        {done ? (
          <Alert tone="success">{done}</Alert>
        ) : (
          <>
            <div>
              <h2 className="text-base font-semibold text-ink">Your action</h2>
              <p className="text-sm text-ink-soft">{intro}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {steps.map((step) => (
                <StepButton key={step.decision} importId={importId} step={step} onDone={setDone} />
              ))}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function StepButton({ importId, step, onDone }: { importId: string; step: ReviewStep; onDone: (message: string) => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null);
  const ids = { title: useId(), message: useId(), reason: useId(), letter: useId() };
  const danger = step.tone === "danger";
  const letterName = step.letter ? LETTER_KINDS[step.letter] : null;

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  async function confirm() {
    // The same checks as the server, so the popup says at once what is missing.
    const fields: Record<string, string> = {};
    if (step.reasonRequired && !reason.trim()) fields.reason = "A reason is required";
    if (letterName && !file) fields.letter = `Upload the ${letterName}`;
    if (Object.keys(fields).length > 0) {
      setError({ message: "Complete the highlighted fields.", fields });
      return;
    }

    setPending(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("decision", step.decision);
      if (step.reasonRequired) body.set("reason", reason.trim());
      if (file) body.set("letter", file);
      const response = await fetch(`/api/imports/${importId}/review`, { method: "POST", body });
      const result = (await response.json().catch(() => null)) as Result<unknown> | null;
      if (result?.ok) {
        dialogRef.current?.close();
        onDone(`${step.label}: done.`);
        router.refresh();
        return;
      }
      setError({
        message: result && !result.ok ? result.error : response.status === 413 ? "The letter is larger than 5 MB." : "That did not work. Try again.",
        fields: result && !result.ok ? (result.fieldErrors ?? {}) : {},
      });
    } catch {
      setError({ message: "That did not work: check the connection and try again.", fields: {} });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" variant={danger ? "danger" : "primary"} onClick={open}>
        {danger ? <X aria-hidden /> : <Check aria-hidden />}
        {step.label}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={ids.title}
        aria-describedby={ids.message}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-xl shadow-ink/20 backdrop:bg-ink/40"
      >
        <div className="flex gap-3 p-5">
          <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-full", danger ? "bg-danger-soft text-danger" : "bg-primary/10 text-primary")}>
            {danger ? <AlertTriangle className="size-5" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-1">
              <h2 id={ids.title} className="text-base font-semibold text-ink">
                {step.title}
              </h2>
              <p id={ids.message} className="text-sm text-ink-soft">
                {step.question}
              </p>
            </div>

            {letterName && (
              <div className="space-y-1.5">
                <p id={ids.letter} className="text-sm font-medium text-ink">
                  {letterName}
                  <span className="text-danger"> *</span>
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept={DOCUMENT_ACCEPT}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} aria-describedby={ids.letter} disabled={pending}>
                    <Upload aria-hidden /> {file ? "Choose another file" : "Choose file"}
                  </Button>
                  {file && (
                    <span className="min-w-0 text-sm wrap-anywhere text-ink">
                      {file.name} <span className="text-xs text-muted">({formatBytes(file.size)})</span>
                    </span>
                  )}
                </div>
                <p className={cx("text-[0.8125rem]", error?.fields.letter ? "text-danger" : "text-muted")}>{error?.fields.letter ?? DOCUMENT_RULES_TEXT}</p>
              </div>
            )}

            {step.reasonRequired && (
              <div className="space-y-1.5">
                <label htmlFor={ids.reason} className="block text-sm font-medium text-ink">
                  Reason<span className="text-danger"> *</span>
                </label>
                <textarea
                  id={ids.reason}
                  rows={4}
                  maxLength={MAX_REASON_LENGTH}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  aria-invalid={error?.fields.reason ? true : undefined}
                  placeholder="What must be corrected?"
                  className={cx(inputClasses, "py-2")}
                />
                {error?.fields.reason && <p className="text-[0.8125rem] text-danger">{error.fields.reason}</p>}
              </div>
            )}

            {error && Object.keys(error.fields).length === 0 && <Alert tone="error">{error.message}</Alert>}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 py-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => dialogRef.current?.close()} autoFocus>
            Cancel
          </Button>
          <Button type="button" variant={danger ? "danger" : "primary"} disabled={pending} onClick={confirm}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {step.label}
          </Button>
        </div>
      </dialog>
    </>
  );
}

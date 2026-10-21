"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useFormState } from "@/components/forms/action-form";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";

/*
 * A submit that asks first, in a popup (decision log 2026-10-19: DigiDocs content, not suite kit;
 * the kit's ConfirmSubmitButton asks in place). Every confirmation in DigiDocs uses it: Delete,
 * Generate tracking number, Save as draft, Submit. Use inside an <ActionForm>: the trigger opens a
 * modal dialog (the browser's <dialog>: Escape cancels, focus stays inside, the page behind is
 * dimmed); its confirm button submits the form; the dialog closes when the action answers.
 *
 *   tone "danger"   a warning sign and a red confirm button (Delete);
 *   tone "confirm"  a tick and the primary button (Save, Submit, Continue).
 */
export function ConfirmDialogButton({
  children,
  title,
  message,
  confirmLabel,
  tone = "danger",
  variant,
  size = "md",
  label,
  disabled,
  onConfirm,
}: {
  children: ReactNode;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "confirm";
  /** The trigger's look; by default red for "danger", primary for "confirm". */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** The trigger's accessible name, when its text alone is not enough ("Delete" → "Delete IMP/…"). */
  label?: string;
  disabled?: boolean;
  /** Runs just before the form is submitted, e.g. to say which button asked (draft or submit). */
  onConfirm?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { pending, result } = useFormState();
  const titleId = useId();
  const messageId = useId();
  const danger = tone === "danger";

  // The action answered: put the question away (a refusal shows under the form, as usual).
  useEffect(() => {
    dialogRef.current?.close();
  }, [result]);

  return (
    <>
      <Button
        type="button"
        variant={variant ?? (danger ? "danger" : "primary")}
        size={size}
        aria-label={label}
        disabled={disabled || pending}
        onClick={() => dialogRef.current?.showModal()}
      >
        {children}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onCancel={(event) => {
          if (pending) event.preventDefault(); // not while the action runs
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-xl shadow-ink/20 backdrop:bg-ink/40"
      >
        <div className="flex gap-3 p-5">
          <span
            className={cx(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              danger ? "bg-danger-soft text-danger" : "bg-primary/10 text-primary",
            )}
          >
            {danger ? <AlertTriangle className="size-5" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            <div id={messageId} className="text-sm wrap-anywhere text-ink-soft">
              {message}
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-line bg-subtle px-5 py-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => dialogRef.current?.close()} autoFocus>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={pending} onClick={onConfirm}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}

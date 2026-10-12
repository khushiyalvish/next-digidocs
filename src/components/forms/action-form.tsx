// Suite kit v7: copied from OnePortal src/components/forms/action-form.tsx. Change it in the hub first, then copy it here.
"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/result";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Alert, controlHeight, inputClasses } from "@/components/ui/primitives";

/*
 * The one form pattern (ARCHITECTURE.md §4–5). Every form in the app is:
 *
 *   <ActionForm action={someServerAction}>
 *     <TextField name="email" label="Email" />
 *     <FormMessage />
 *     <SubmitButton>Save</SubmitButton>
 *   </ActionForm>
 *
 * The server action validates with the feature's schema and returns a Result; field errors
 * appear under their fields, the overall error or success message in <FormMessage />.
 * Fields keep what was typed after a failed submit (React's automatic form reset is bypassed).
 */

type FormAction = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

interface FormState {
  result: ActionResult | null;
  pending: boolean;
}

const FormContext = createContext<FormState>({ result: null, pending: false });

export function useFormState(): FormState {
  return useContext(FormContext);
}

export function ActionForm({
  action,
  children,
  className,
  hidden,
  resetOnSuccess = false,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  /** Hidden inputs, e.g. { userId }. The server re-checks them like any other input. */
  hidden?: Record<string, string>;
  /** Clear the fields after a successful submit (e.g. change-password). */
  resetOnSuccess?: boolean;
}) {
  const [result, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && result?.ok) formRef.current?.reset();
  }, [result, resetOnSuccess]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <FormContext value={{ result, pending }}>
      <form ref={formRef} onSubmit={handleSubmit} noValidate className={className}>
        {hidden &&
          Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
        {children}
      </form>
    </FormContext>
  );
}

/** The form's overall error, or its success message. */
export function FormMessage({ className, successMessage = true }: { className?: string; successMessage?: boolean }) {
  const { result } = useFormState();
  if (!result) return null;
  if (!result.ok) {
    return (
      <Alert tone="error" className={className}>
        {result.error}
      </Alert>
    );
  }
  if (successMessage && result.message) {
    return (
      <Alert tone="success" className={className}>
        {result.message}
      </Alert>
    );
  }
  return null;
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { pending } = useFormState();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending} className={className}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

// ---- Fields -------------------------------------------------------------------------------

function useFieldError(name: string): string | undefined {
  const { result } = useFormState();
  return result && !result.ok ? result.fieldErrors?.[name] : undefined;
}

function FieldShell({
  id,
  label,
  labelAside,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  labelAside?: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {labelAside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-[0.8125rem] text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type TextFieldProps = {
  name: string;
  label: string;
  labelAside?: ReactNode;
  hint?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id" | "className">;

export function TextField({ name, label, labelAside, hint, type = "text", ...inputProps }: TextFieldProps) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} labelAside={labelAside} hint={hint} error={error}>
      <input
        id={id}
        name={name}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cx(inputClasses, controlHeight)}
        {...inputProps}
      />
    </FieldShell>
  );
}

/** A password input with a show/hide toggle. */
export function PasswordField({ name, label, labelAside, hint, ...inputProps }: Omit<TextFieldProps, "type">) {
  const id = useId();
  const error = useFieldError(name);
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} labelAside={labelAside} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cx(inputClasses, controlHeight, "pr-11")}
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-field text-faint hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  rows = 3,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  rows?: number;
  defaultValue?: string;
  placeholder?: string;
}) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cx(inputClasses, "py-2")}
      />
    </FieldShell>
  );
}

/** A single on/off checkbox, or one of a group sharing `name` (pass `value`). */
export function CheckboxField({
  name,
  label,
  description,
  value,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  value?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx("flex gap-3 py-0.5", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5 size-5 shrink-0 cursor-[inherit] rounded border-line-strong accent-primary sm:size-4"
      />
      <span className="min-w-0 wrap-anywhere">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-[0.8125rem] text-muted">{description}</span>}
      </span>
    </label>
  );
}

/** Shows the error for a field that is not a single input (e.g. a checkbox group). */
export function FieldError({ name }: { name: string }) {
  const error = useFieldError(name);
  return error ? <p className="text-[0.8125rem] text-danger">{error}</p> : null;
}

/**
 * A destructive submit that asks first: the first click turns into "Confirm / Cancel".
 * No modal — the question appears where the person is already looking.
 */
export function ConfirmSubmitButton({
  children,
  confirmLabel,
  question,
  variant = "danger",
  size = "md",
}: {
  children: ReactNode;
  confirmLabel: string;
  question: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const { pending, result } = useFormState();
  // Remembers which answer was on screen when the question was asked. When the action
  // answers, `result` changes and the button returns to rest by itself.
  const [askedWith, setAskedWith] = useState<ActionResult | null | undefined>(undefined);
  const asking = askedWith !== undefined && askedWith === result;

  if (!asking) {
    return (
      <Button variant={variant} size={size} onClick={() => setAskedWith(result)}>
        {children}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[0.8125rem] text-ink-soft">{question}</span>
      <Button variant="ghost" size={size} onClick={() => setAskedWith(undefined)} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" variant={variant === "danger" ? "danger" : "primary"} size={size} disabled={pending} autoFocus>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {confirmLabel}
      </Button>
    </div>
  );
}

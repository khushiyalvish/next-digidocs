// Suite kit v7: copied from OnePortal src/app/(auth)/auth-card.tsx. Change it in the hub first, then copy it here.
import type { ReactNode } from "react";

/** The white card every signed-out page is built from. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <div className="rounded-card border border-line bg-surface px-5 py-7 shadow-xl shadow-ink/5 sm:px-8 sm:py-9">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-2 text-sm wrap-anywhere text-muted sm:text-base">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
    </>
  );
}

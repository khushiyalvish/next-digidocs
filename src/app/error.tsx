// Suite kit v7: copied from OnePortal src/app/error.tsx. Change it in the hub first, then copy it here.
"use client";

import { Button } from "@/components/ui/button";

/**
 * The error boundary for unexpected failures (database down, a bug). Expected failures never
 * reach here — they come back as Results. Details go to the server log, not to the screen.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Please try again. If it keeps happening, contact your administrator
        {error.digest ? (
          <>
            {" "}
            and quote reference <code className="font-mono text-ink-soft">{error.digest}</code>
          </>
        ) : null}
        .
      </p>
      <Button variant="secondary" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

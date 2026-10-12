// Suite kit v7: adapted from OnePortal src/app/not-found.tsx (wording of the link). Merge hub changes by hand.
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-faint">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        The page does not exist, or you do not have access to it.
      </p>
      <Link href="/" className={buttonClasses("secondary", "md", "mt-6")}>
        Back to home
      </Link>
    </div>
  );
}

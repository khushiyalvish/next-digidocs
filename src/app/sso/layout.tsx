// Suite kit v7: adapted from OnePortal src/app/(auth)/layout.tsx (the /sso pages, DigiDocs's own wording). Merge hub changes by hand.
import type { ReactNode } from "react";
import { FileText, LayoutGrid, ShieldCheck } from "lucide-react";
import { getConfig } from "@/lib/config";
import { AuthShell, type AuthPoint } from "@/components/shell/auth-shell";

// Wording only: no figures or names from the database, because nobody has signed in yet
// (hub CHILD-APP-GUIDE.md §7.4).
const POINTS: AuthPoint[] = [
  { icon: FileText, title: "Your documents in one place", text: "Find, share and keep track of the documents you work with." },
  { icon: LayoutGrid, title: "Part of OnePortal", text: "Open it from OnePortal, already signed in." },
  { icon: ShieldCheck, title: "No separate password", text: "You sign in through OnePortal only." },
];

/** The signed-out pages under /sso: the suite's panel beside a single centred column. */
export default function SsoLayout({ children }: { children: ReactNode }) {
  const { appName, organizationName } = getConfig();
  return (
    <AuthShell
      appName={appName}
      organizationName={organizationName}
      headline="Your organisation's documents, ready when you are."
      description={`${appName} is part of OnePortal: open it from the launcher and you are already signed in.`}
      points={POINTS}
    >
      {children}
    </AuthShell>
  );
}

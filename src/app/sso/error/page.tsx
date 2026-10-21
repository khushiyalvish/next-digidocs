import type { Metadata } from "next";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { buttonClasses } from "@/components/ui/button";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: "Sign-in problem" };

// Set by src/app/sso/callback/route.ts. Anything else (or nothing) reads as "unknown".
const reasonSchema = z.enum(["state", "missing-code", "rejected", "no-access", "unknown"]).catch("unknown");

const MESSAGES: Record<z.infer<typeof reasonSchema>, string> = {
  state: "The sign-in could not be matched to this browser. It may have taken too long, or been started in another tab.",
  "missing-code": "OnePortal did not send a sign-in code.",
  rejected: "OnePortal did not accept the sign-in. Your access may have changed, or the link was already used.",
  "no-access": "Your DigiDocs account is deactivated. Contact your administrator if you need access.",
  unknown: "Something went wrong while signing you in.",
};

/**
 * Where every failed sign-in lands (hub CHILD-APP-GUIDE.md §5.6). It never redirects to
 * /sso/login by itself: a misconfiguration would otherwise become an endless loop.
 */
export default async function SignInErrorPage({ searchParams }: PageProps<"/sso/error">) {
  const reason = reasonSchema.parse((await searchParams).reason);
  const { onePortal } = getConfig();

  return (
    <AuthCard title="We could not sign you in" description={MESSAGES[reason]}>
      <div className="flex flex-col gap-3">
        <a href={onePortal.url} className={buttonClasses("primary", "md", "w-full")}>
          Back to OnePortal
        </a>
        <p className="text-center text-[0.8125rem] text-muted">Open DigiDocs again from the OnePortal launcher.</p>
      </div>
    </AuthCard>
  );
}

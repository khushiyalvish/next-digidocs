// Suite kit v7: copied from OnePortal next.config.ts. Change it in the hub first, then copy it here.
import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Security headers on every response (AUDIT.md §1, "Transport and headers").
 * - Referrer-Policy no-referrer: password-reset links carry a token in the URL; it must never
 *   leak to another site through the Referer header.
 * - frame-ancestors 'none': the hub cannot be framed (clickjacking of the sign-in form).
 * - script-src allows inline scripts because Next.js injects them; 'unsafe-eval' only in dev
 *   (React Refresh needs it).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Database and mail drivers use Node APIs; load them from node_modules at runtime rather than bundling.
  serverExternalPackages: ["mssql", "nodemailer"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;

// Suite kit v7: adapted from OnePortal src/lib/config.ts (OnePortal settings added; mail, passwords and TEST_USER_PASSWORD removed). Merge hub changes by hand.
import "server-only";
import path from "node:path";
import { z } from "zod";

/**
 * The one place settings are read (ARCHITECTURE.md §8e). Nothing else reads process.env.
 *
 * Parsed on first use and cached. src/instrumentation.ts calls getConfig() at server start,
 * so a missing or malformed setting stops the server with a list instead of failing in
 * whichever request first needs it. Template: .env.example.
 */

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const settingsSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    // The port `npm run dev` / `npm run start` and VS Code's F5 listen on. Read by Next.js
    // itself (via dotenv-cli in package.json, envFile in .vscode/launch.json); here only to
    // check that APP_URL agrees with it.
    PORT: z.coerce.number().int().min(1).max(65535).optional(),

    // ADO.NET-style connection string, e.g.
    // Server=localhost,1433;Database=DigiDocsOPNext;User Id=digidocs_app;Password=...;Encrypt=true
    DATABASE_CONNECTION_STRING: z.string().min(1),

    // Public base URL of this application, e.g. https://digidocs.example.com.
    // Never derived from the request's Host header, which the client controls.
    APP_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
    APP_NAME: z.string().min(1).default("DigiDocs"),
    ORGANIZATION_NAME: z.string().min(1).default("Your organization"),

    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(8),

    // "true" lets `npm run data:clear` delete this database's data. For a test installation
    // only: the server says so in its log at every start (getConfig, below).
    ALLOW_DATA_CLEAR: booleanString.default(false),

    // Sign-in through OnePortal (hub CHILD-APP-GUIDE.md §5.1). The App ID and secret come from
    // the hub's Administration → Applications → Register application screen.
    ONEPORTAL_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
    ONEPORTAL_APP_ID: z.guid(),
    ONEPORTAL_APP_SECRET: z.string().min(32),

    // Folder where uploaded import and export documents are kept: outside the web root (Next.js
    // serves only public/), served only through the guarded download route. Relative to the
    // project folder unless absolute. Back it up together with the database.
    UPLOADS_DIR: z.string().trim().min(1).default("uploads"),

    // Header set by YOUR reverse proxy carrying the client IP (e.g. x-forwarded-for).
    // Leave empty when there is no proxy: IPs are then not recorded.
    CLIENT_IP_HEADER: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .transform((value) => value || undefined),
  })
  .superRefine((settings, ctx) => {
    // On this machine, the sign-in callback and cookies follow APP_URL: after changing PORT, a
    // stale APP_URL would send people to a port nothing listens on. Behind a proxy the two are
    // unrelated. (zod runs this even when a field failed above; then APP_URL may not be a URL.)
    if (settings.PORT !== undefined && URL.canParse(settings.APP_URL)) {
      const url = new URL(settings.APP_URL);
      const urlPort = Number(url.port || (url.protocol === "https:" ? 443 : 80));
      if (LOCAL_HOSTS.has(url.hostname) && urlPort !== settings.PORT) {
        ctx.addIssue({
          code: "custom",
          path: ["APP_URL"],
          message: `Uses port ${urlPort}, but PORT is ${settings.PORT}. Change one so they match`,
        });
      }
    }
    if (settings.NODE_ENV === "production" && !settings.APP_URL.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "Must be https:// in production" });
    }
  });

export type Config = ReturnType<typeof toConfig>;

function toConfig(settings: z.infer<typeof settingsSchema>) {
  return {
    isProduction: settings.NODE_ENV === "production",
    databaseConnectionString: settings.DATABASE_CONNECTION_STRING,
    appUrl: settings.APP_URL,
    appName: settings.APP_NAME,
    organizationName: settings.ORGANIZATION_NAME,
    // Cookies are marked Secure whenever the application is served over HTTPS.
    secureCookies: settings.APP_URL.startsWith("https://"),
    sessionTtlHours: settings.SESSION_TTL_HOURS,
    allowDataClear: settings.ALLOW_DATA_CLEAR,
    onePortal: {
      url: settings.ONEPORTAL_URL,
      appId: settings.ONEPORTAL_APP_ID,
      appSecret: settings.ONEPORTAL_APP_SECRET,
    },
    clientIpHeader: settings.CLIENT_IP_HEADER,
    // Runtime data, not code: the bundler must not trace (and ship) the folder.
    uploadsDir: path.resolve(/* turbopackIgnore: true */ process.cwd(), settings.UPLOADS_DIR),
  };
}

let cached: Config | undefined;

export function getConfig(): Config {
  if (cached) return cached;

  // An empty value (CLIENT_IP_HEADER=) means "not set", as people expect from .env files.
  const environment = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ""));
  const parsed = settingsSchema.safeParse(environment);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(settings)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid settings. Fix these in .env.local (template: .env.example):\n${problems}`);
  }

  cached = toConfig(parsed.data);
  if (cached.allowDataClear) {
    // Once per process, at server start (src/instrumentation.ts reads the settings then).
    console.warn(
      "ALLOW_DATA_CLEAR is true: `npm run data:clear` can delete this database's data. For testing only — remove the setting before real people use this installation.",
    );
  }
  return cached;
}

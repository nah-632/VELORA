/**
 * Environment validation.
 *
 * Two separate worlds, deliberately in one file so the split is impossible to forget:
 *
 *   publicEnv  — safe to reach the browser.
 *   serverEnv()— server only. Calling it in the browser throws.
 *
 * A missing variable fails here, naming itself. It must never surface later as `undefined` inside
 * an authorization path.
 *
 * This file was rewritten for ADDENDUM E. It used to validate Supabase's keys and a payment
 * provider nobody had chosen; what the CranL deployment actually needs is a database, a secret to
 * pepper hashes with, and nothing else.
 */
import { z } from "zod";

const publicSchema = z.object({
  // Absolute URLs appear in Open Graph tags and in the WhatsApp message templates, so this is not
  // optional and it is not derived from the request host: a link built from a header can be made
  // to point somewhere else.
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  /**
   * Peppers the hashes of IP addresses stored with login attempts. An IP address is personal data;
   * a table of the operator's login addresses should not be readable by anyone who obtains a dump
   * of it.
   */
  SESSION_SECRET: z.string().min(32),
  /** Only used by the seed script, and only on first run: `scripts/seed-admin.mjs`. */
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  /** Shared secret for scheduled work. Unused while the cron jobs run as container commands. */
  CRON_SECRET: z.string().min(24).optional(),
  /** Set to "1" to make /api/health include the sanitized driver message. Diagnosis only. */
  HEALTH_VERBOSE: z.literal("1").optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function formatIssues(scope: string, error: z.ZodError): string {
  const lines = error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
  return `Invalid ${scope} environment.\n${lines}\nSee .env.example for the expected shape.`;
}

function parsePublic(): PublicEnv {
  const result = publicSchema.safeParse({
    /**
     * The localhost fallback is for development only.
     *
     * It used to apply in production too, which meant a deployment that forgot this variable would
     * boot happily and then put `http://localhost:3000/i/<token>` in every WhatsApp message it sent.
     * A wrong link in 50 messages is not a configuration detail; it is the product failing quietly.
     * In production the variable is now required, and the failure names it.
     */
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.NODE_ENV === "production" ? undefined : "http://localhost:3000"),
  });
  if (!result.success) throw new Error(formatIssues("public", result.error));
  return result.data;
}

let cachedServerEnv: ServerEnv | null = null;

/**
 * Server-only environment. Throws in a browser context — if this ever fires in the client,
 * something is importing a server module into a client component, which is a bug worth failing on
 * rather than shipping.
 *
 * Parsed on demand rather than at module load, so that a page which needs none of it (the public
 * invitation, the brand pages) still serves when one of these is missing. The paths that do need
 * it name the variable instead of failing obscurely.
 */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "serverEnv() was called in the browser. Server configuration must not reach the client.",
    );
  }
  if (cachedServerEnv) return cachedServerEnv;
  const result = serverSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    CRON_SECRET: process.env.CRON_SECRET,
    HEALTH_VERBOSE: process.env.HEALTH_VERBOSE,
  });
  if (!result.success) throw new Error(formatIssues("server", result.error));
  cachedServerEnv = result.data;
  return result.data;
}

/** Parsed eagerly at module load: a misconfigured deployment fails on boot, not on first click. */
export const publicEnv: PublicEnv = parsePublic();

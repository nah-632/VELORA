/**
 * Environment validation.
 *
 * Two separate worlds, deliberately in one file so the split is impossible to forget:
 *
 *   publicEnv  — safe to reach the browser (an anon key is not a secret).
 *   serverEnv()— server only. Calling it in the browser throws.
 *
 * A missing variable fails here, at startup, naming itself. It must never surface later as
 * `undefined` inside a payment or authorization path.
 */
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  DATABASE_URL: z.string().min(1).optional(),
  // Payments: no provider has been selected. These stay optional and unset.
  PAYMENT_PROVIDER: z.enum(["none", "manual"]).default("none"),
  PAYMENT_PROVIDER_PUBLIC_KEY: z.string().optional(),
  PAYMENT_PROVIDER_SECRET_KEY: z.string().optional(),
  PAYMENT_PROVIDER_WEBHOOK_SECRET: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function formatIssues(scope: string, error: z.ZodError): string {
  const lines = error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
  return `Invalid ${scope} environment.\n${lines}\nSee .env.example for the expected shape.`;
}

function parsePublic(): PublicEnv {
  const result = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Local development default; production must set this explicitly.
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  });
  if (!result.success) throw new Error(formatIssues("public", result.error));
  return result.data;
}

let cachedServerEnv: ServerEnv | null = null;

/**
 * Server-only environment. Throws in a browser context — if this ever fires in the client,
 * something is importing a server module into a client component, which is a bug worth
 * failing on rather than shipping.
 */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() was called in the browser. Server configuration must not reach the client.");
  }
  if (cachedServerEnv) return cachedServerEnv;
  const result = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    PAYMENT_PROVIDER_PUBLIC_KEY: process.env.PAYMENT_PROVIDER_PUBLIC_KEY,
    PAYMENT_PROVIDER_SECRET_KEY: process.env.PAYMENT_PROVIDER_SECRET_KEY,
    PAYMENT_PROVIDER_WEBHOOK_SECRET: process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET,
  });
  if (!result.success) throw new Error(formatIssues("server", result.error));
  cachedServerEnv = result.data;
  return result.data;
}

/** Parsed eagerly at module load: a misconfigured deployment fails on boot, not on first click. */
export const publicEnv: PublicEnv = parsePublic();

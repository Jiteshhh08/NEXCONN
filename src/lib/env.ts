import "server-only";

import { z } from "zod";

const booleanFlag = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}, z.boolean());

// `.env` files usually express "unset" as an empty string. Treat blank values
// as absent so optional integrations do not fail environment validation.
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(
  blankToUndefined,
  z.string().trim().optional(),
);

const optionalUrl = z.preprocess(blankToUndefined, z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  // Validated further at runtime by getSessionSecret(). Keeping it optional
  // here lets `next build` collect routes without deployment-only secrets.
  SESSION_SECRET: optionalString,

  // Only trust a client-IP header when a proxy you control overwrites it.
  // `none` ignores all client-supplied forwarding headers.
  TRUSTED_PROXY_HEADER: z
    .enum([
      "none",
      "x-forwarded-for",
      "x-real-ip",
      "cf-connecting-ip",
      "x-vercel-forwarded-for",
    ])
    .default("none"),
  // Number of trusted proxies between the client and this server. Only used
  // for comma-separated forwarding headers; at least one hop must exist for
  // the values at the right edge of the chain to be trustworthy.
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).max(10).default(1),

  NEXCONN_APP_KEY: optionalString,
  NEXCONN_APP_SECRET: optionalString,
  NEXCONN_API_BASE_URL: optionalUrl,
  NEXCONN_WEBHOOK_SECRET: optionalString,
  NEXCONN_CHAT_PROVIDER: z.enum(["local", "nexconn"]).default("local"),

  TRANSLATION_PROVIDER: z
    .enum(["passthrough", "nexconn", "libretranslate"])
    .default("passthrough"),
  LIBRETRANSLATE_URL: optionalUrl,
  LIBRETRANSLATE_API_KEY: optionalString,

  TRANSLATION_ENABLED: booleanFlag.default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === "production";
const DEVELOPMENT_SESSION_SECRET =
  "vaani-room-development-only-secret-do-not-use-in-production";

/**
 * Runtime-only validation. Next.js evaluates server modules during production
 * route collection, where deployment secrets such as SESSION_SECRET are not
 * expected to be present. Build-time collection must not fail for that reason;
 * the real server process validates before it accepts traffic.
 */
export function assertRuntimeEnv(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Throws in production when SESSION_SECRET is absent.
  getSessionSecret();

  if (
    raw.NEXCONN_CHAT_PROVIDER === "nexconn" &&
    (!raw.NEXCONN_APP_KEY || !raw.NEXCONN_APP_SECRET)
  ) {
    throw new Error(
      "NEXCONN_APP_KEY and NEXCONN_APP_SECRET are required when NEXCONN_CHAT_PROVIDER=nexconn.",
    );
  }
}

/**
 * Returns the signing secret. Development keeps a local-only fallback so the
 * app can run without setup; production never receives a fallback.
 */
export function getSessionSecret(): string {
  const secret = raw.SESSION_SECRET;

  if (secret) {
    if (secret.length < 32) {
      throw new Error(
        "SESSION_SECRET must be at least 32 characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
      );
    }
    return secret;
  }

  if (!isProduction) return DEVELOPMENT_SESSION_SECRET;

  throw new Error(
    "SESSION_SECRET is required in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
  );
}

export const serverEnv = Object.freeze({
  ...raw,
  get SESSION_SECRET(): string {
    return getSessionSecret();
  },
});

export type ServerEnv = typeof serverEnv;

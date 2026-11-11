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
  SESSION_SECRET: z.preprocess(
    blankToUndefined,
    z.string().min(32).optional(),
  ),

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

if (isProduction && !raw.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET is required in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
  );
}

if (
  raw.NEXCONN_CHAT_PROVIDER === "nexconn" &&
  (!raw.NEXCONN_APP_KEY || !raw.NEXCONN_APP_SECRET)
) {
  throw new Error(
    "NEXCONN_APP_KEY and NEXCONN_APP_SECRET are required when NEXCONN_CHAT_PROVIDER=nexconn.",
  );
}

export const serverEnv = Object.freeze({
  ...raw,
  SESSION_SECRET:
    raw.SESSION_SECRET ??
    "vaani-room-development-only-secret-do-not-use-in-production",
});

export type ServerEnv = typeof serverEnv;

import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCHEME = "scrypt";

/**
 * Fixed salt used when there is no real hash to verify. Running the same
 * scrypt work for an unknown email or a malformed hash keeps the response time
 * close to a failed password check, so login cannot be used to enumerate
 * accounts by timing.
 */
const DUMMY_SALT = Buffer.alloc(SALT_LENGTH, 7);

async function burnPasswordWork(password: string): Promise<void> {
  await scrypt(password, DUMMY_SALT, KEY_LENGTH);
}

/**
 * Hashes a password with scrypt and a random salt.
 * Format: scrypt$<salt base64url>$<hash base64url>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH);

  return `${SCHEME}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

/**
 * Verifies a password against a stored hash. Returns false for malformed
 * hashes instead of throwing, so callers can use one generic login error.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (!storedHash) {
    await burnPasswordWork(password);
    return false;
  }

  const [scheme, saltPart, hashPart] = storedHash.split("$");
  if (scheme !== SCHEME || !saltPart || !hashPart) {
    await burnPasswordWork(password);
    return false;
  }

  const salt = Buffer.from(saltPart, "base64url");
  const expected = Buffer.from(hashPart, "base64url");
  if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) {
    await burnPasswordWork(password);
    return false;
  }

  const derived = await scrypt(password, salt, KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}

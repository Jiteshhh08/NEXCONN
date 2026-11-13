import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { forbidden, unauthorized } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import type { UserRole } from "@/lib/domain";

export const SESSION_COOKIE_NAME = "vaani_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  displayName: string | null;
  email: string | null;
  role: UserRole;
  preferredLanguage: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toSessionUser(user: {
  id: string;
  displayName: string | null;
  email: string | null;
  role: string;
  preferredLanguage: string;
}): SessionUser {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role === "host" ? "host" : "student",
    preferredLanguage: user.preferredLanguage,
  };
}

export async function createSession(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session
      .delete({ where: { id: session.id } })
      .catch(() => undefined);
    return null;
  }

  // `lastSeenAt` is meaningful only if it is actually written. Throttle the
  // update so a polling room board does not write on every request.
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => undefined);
  }

  return toSessionUser(session.user);
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }

  await clearSessionCookie();
}

export async function requireHost(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    throw unauthorized("Sign in as a host to continue.");
  }

  if (user.role !== "host") {
    throw forbidden("Only a host can perform this action.");
  }

  return user;
}

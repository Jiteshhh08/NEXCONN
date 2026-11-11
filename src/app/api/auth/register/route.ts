import { apiError, apiSuccess, parseJson } from "@/lib/api/response";
import { AppError, conflict } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/request";
import { prisma } from "@/lib/db";
import { registerHostSchema } from "@/lib/validation";
import { hashPassword } from "@/server/auth/password";
import { checkRateLimit, getClientKey } from "@/server/auth/rate-limit";
import { createSession, setSessionCookie } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const limit = checkRateLimit(
      getClientKey(request, "register"),
      5,
      15 * 60 * 1000,
    );
    if (!limit.allowed) {
      throw new AppError(
        "RATE_LIMITED",
        "Too many sign-up attempts. Please try again later.",
        429,
        { retryAfterSeconds: limit.retryAfterSeconds },
      );
    }

    const input = await parseJson(request, registerHostSchema);

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw conflict("An account with this email already exists.");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        displayName: input.displayName,
        email: input.email,
        passwordHash,
        role: "host",
        isGuest: false,
        preferredLanguage: "en",
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        preferredLanguage: true,
      },
    });

    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);

    return apiSuccess(
      { user, expiresAt: expiresAt.toISOString() },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

import { apiError, apiSuccess, parseJson } from "@/lib/api/response";
import { AppError, unauthorized } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/request";
import { prisma } from "@/lib/db";
import { loginHostSchema } from "@/lib/validation";
import { verifyPassword } from "@/server/auth/password";
import { checkRateLimit, getClientKey } from "@/server/auth/rate-limit";
import { createSession, setSessionCookie } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const limit = checkRateLimit(
      getClientKey(request, "login"),
      10,
      15 * 60 * 1000,
    );
    if (!limit.allowed) {
      throw new AppError(
        "RATE_LIMITED",
        "Too many sign-in attempts. Please try again later.",
        429,
        { retryAfterSeconds: limit.retryAfterSeconds },
      );
    }

    const input = await parseJson(request, loginHostSchema);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        preferredLanguage: true,
        passwordHash: true,
      },
    });

    const passwordMatches = await verifyPassword(
      input.password,
      user?.passwordHash,
    );

    if (!user || !passwordMatches || user.role !== "host") {
      throw unauthorized("Email or password is incorrect.");
    }

    const { token, expiresAt } = await createSession(user.id);
    await setSessionCookie(token, expiresAt);

    return apiSuccess({
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
      },
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}

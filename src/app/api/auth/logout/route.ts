import { apiError, apiSuccess } from "@/lib/api/response";
import { assertSameOrigin } from "@/lib/api/request";
import { destroyCurrentSession } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await destroyCurrentSession();
    return apiSuccess({ signedOut: true });
  } catch (error) {
    return apiError(error);
  }
}

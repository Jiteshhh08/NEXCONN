import { apiError, apiSuccess } from "@/lib/api/response";
import { getSessionUser } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    return apiSuccess({ user });
  } catch (error) {
    return apiError(error);
  }
}

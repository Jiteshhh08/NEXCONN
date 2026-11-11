import { AppError } from "@/lib/api/errors";
import { apiError, apiSuccess } from "@/lib/api/response";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return apiSuccess({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return apiError(
      new AppError(
        "INTERNAL_ERROR",
        "The database is not available.",
        503,
      ),
    );
  }
}

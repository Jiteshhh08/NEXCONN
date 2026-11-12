import "server-only";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

import { AppError } from "@/lib/api/errors";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Every API response is uncacheable. The room board polls these endpoints for
 * newly published answers, questions and votes, and a cached (or proxy-cached)
 * body would keep the answer hidden until a full page reload.
 */
function withNoStore(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return { ...init, headers };
}

export function apiSuccess<T>(
  data: T,
  init?: ResponseInit,
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, withNoStore(init));
}

export function apiFailure(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      ok: false,
      error: details === undefined ? { code, message } : { code, message, details },
    },
    withNoStore({ status }),
  );
}

/**
 * Converts any thrown value into the documented API error envelope.
 * Unknown errors are logged server-side and never leaked to the browser.
 */
export function apiError(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof AppError) {
    return apiFailure(
      error.code,
      error.message,
      error.status,
      error.details,
    );
  }

  if (error instanceof ZodError) {
    return apiFailure(
      "VALIDATION_ERROR",
      "Please check the submitted fields.",
      422,
      {
        fieldErrors: error.issues.map((issue) => ({
          field: issue.path.join(".") || "(body)",
          message: issue.message,
        })),
      },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiFailure(
        "CONFLICT",
        "That action conflicts with an existing record.",
        409,
      );
    }
    if (error.code === "P2025") {
      return apiFailure("NOT_FOUND", "We could not find that record.", 404);
    }
  }

  console.error("[api] Unhandled error:", error);
  return apiFailure(
    "INTERNAL_ERROR",
    "Something went wrong. Please try again.",
    500,
  );
}

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new AppError(
      "INVALID_JSON",
      "Request body must be valid JSON.",
      400,
    );
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Please check the submitted fields.",
      422,
      {
        fieldErrors: result.error.issues.map((issue) => ({
          field: issue.path.join(".") || "(body)",
          message: issue.message,
        })),
      },
    );
  }

  return result.data;
}

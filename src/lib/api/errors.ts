export const API_ERROR_CODES = [
  "INVALID_JSON",
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "ROOM_CLOSED",
  "DUPLICATE_VOTE",
  "RATE_LIMITED",
  "TRANSLATION_UNAVAILABLE",
  "INTEGRATION_NOT_CONFIGURED",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: ApiErrorCode,
    message: string,
    status = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class IntegrationNotConfiguredError extends AppError {
  constructor(service: string) {
    super(
      "INTEGRATION_NOT_CONFIGURED",
      `${service} is not configured yet. See TEAM_LEAD.md for the required credentials and setup steps.`,
      503,
    );
    this.name = "IntegrationNotConfiguredError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError("VALIDATION_ERROR", message, 422, details);

export const unauthorized = (message = "Please sign in to continue.") =>
  new AppError("UNAUTHORIZED", message, 401);

export const forbidden = (message = "You do not have access to this action.") =>
  new AppError("FORBIDDEN", message, 403);

export const notFound = (message = "We could not find that record.") =>
  new AppError("NOT_FOUND", message, 404);

export const conflict = (message: string) =>
  new AppError("CONFLICT", message, 409);

export const roomClosed = () =>
  new AppError(
    "ROOM_CLOSED",
    "This room is closed and is no longer accepting participation.",
    409,
  );

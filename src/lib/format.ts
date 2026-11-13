/**
 * Vaani Room is used in Indian classrooms, and timestamps are rendered on the
 * server as well as in the browser. An explicit zone makes both render the
 * same wall-clock time regardless of where the server process runs.
 */
export const APP_TIME_ZONE = "Asia/Kolkata";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

export function formatDate(value: Date | string): string {
  return dateFormatter.format(
    typeof value === "string" ? new Date(value) : value,
  );
}

export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(
    typeof value === "string" ? new Date(value) : value,
  );
}

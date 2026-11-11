const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
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

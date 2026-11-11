export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

/**
 * Small class-name joiner. Kept dependency-free so shared UI components can be
 * imported from both server and client components.
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  const visit = (value: ClassValue): void => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, enabled] of Object.entries(value)) {
      if (enabled) classes.push(key);
    }
  };

  inputs.forEach(visit);
  return classes.join(" ");
}

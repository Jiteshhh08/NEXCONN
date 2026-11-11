export const USER_ROLES = ["host", "student"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROOM_STATUSES = ["active", "closed"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const MODERATION_STATUSES = [
  "pending",
  "approved",
  "hidden",
  "rejected",
] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const HOST_MODERATION_ACTIONS = [
  "approved",
  "hidden",
  "rejected",
] as const;
export type HostModerationAction = (typeof HOST_MODERATION_ACTIONS)[number];

export const TRANSLATION_STATUSES = [
  "pending",
  "ready",
  "failed",
  "unavailable",
] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export const LANGUAGE_CODES = [
  "en",
  "hi",
  "mr",
  "gu",
  "ta",
  "te",
  "bn",
  "kn",
  "ml",
  "pa",
  "or",
  "ur",
] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export interface LanguageDefinition {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  direction: "ltr" | "rtl";
}

const LANGUAGE_META: Record<
  LanguageCode,
  Omit<LanguageDefinition, "code">
> = {
  en: { label: "English", nativeLabel: "English", direction: "ltr" },
  hi: { label: "Hindi", nativeLabel: "हिन्दी", direction: "ltr" },
  mr: { label: "Marathi", nativeLabel: "मराठी", direction: "ltr" },
  gu: { label: "Gujarati", nativeLabel: "ગુજરાતી", direction: "ltr" },
  ta: { label: "Tamil", nativeLabel: "தமிழ்", direction: "ltr" },
  te: { label: "Telugu", nativeLabel: "తెలుగు", direction: "ltr" },
  bn: { label: "Bengali", nativeLabel: "বাংলা", direction: "ltr" },
  kn: { label: "Kannada", nativeLabel: "ಕನ್ನಡ", direction: "ltr" },
  ml: { label: "Malayalam", nativeLabel: "മലയാളം", direction: "ltr" },
  pa: { label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", direction: "ltr" },
  or: { label: "Odia", nativeLabel: "ଓଡ଼ିଆ", direction: "ltr" },
  ur: { label: "Urdu", nativeLabel: "اردو", direction: "rtl" },
};

export const LANGUAGES: readonly LanguageDefinition[] = LANGUAGE_CODES.map(
  (code) => ({ code, ...LANGUAGE_META[code] }),
);

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isLanguageCode(value: unknown): value is LanguageCode {
  return (
    typeof value === "string" &&
    (LANGUAGE_CODES as readonly string[]).includes(value)
  );
}

export function getLanguage(
  code: string | null | undefined,
): LanguageDefinition {
  if (isLanguageCode(code)) {
    return LANGUAGES.find((language) => language.code === code)!;
  }
  return LANGUAGES.find((language) => language.code === DEFAULT_LANGUAGE)!;
}

export function isRoomStatus(value: unknown): value is RoomStatus {
  return (
    typeof value === "string" &&
    (ROOM_STATUSES as readonly string[]).includes(value)
  );
}

export function isModerationStatus(
  value: unknown,
): value is ModerationStatus {
  return (
    typeof value === "string" &&
    (MODERATION_STATUSES as readonly string[]).includes(value)
  );
}

export const MODERATION_LABELS: Record<ModerationStatus, string> = {
  pending: "Awaiting review",
  approved: "Approved",
  hidden: "Hidden",
  rejected: "Rejected",
};

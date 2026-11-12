import { z } from "zod";

import {
  HOST_MODERATION_ACTIONS,
  LANGUAGE_CODES,
} from "@/lib/domain";

const languageCodeSchema = z.enum(LANGUAGE_CODES);

const trimmedString = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

const emailSchema = z
  .email("Enter a valid email address.")
  .trim()
  .toLowerCase()
  .max(200, "Email must be at most 200 characters.");

export const registerHostSchema = z
  .object({
    displayName: trimmedString(2, 60, "Name"),
    email: emailSchema,
    password: z
      .string()
      .min(10, "Password must be at least 10 characters.")
      .max(200, "Password must be at most 200 characters."),
  })
  .strict();

export type RegisterHostInput = z.infer<typeof registerHostSchema>;

export const loginHostSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, "Enter your password.").max(200),
  })
  .strict();

export type LoginHostInput = z.infer<typeof loginHostSchema>;

export const createRoomSchema = z
  .object({
    title: trimmedString(3, 120, "Room title"),
    hostLanguage: languageCodeSchema,
  })
  .strict();

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const joinRoomSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .max(40, "Display name must be at most 40 characters.")
      .optional()
      .transform((value) => (value ? value : undefined)),
    preferredLanguage: languageCodeSchema,
    isAnonymous: z.boolean().default(false),
  })
  .strict();

export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

export const submitQuestionSchema = z
  .object({
    text: trimmedString(3, 1000, "Question"),
    sourceLanguage: languageCodeSchema,
    isAnonymous: z.boolean().default(false),
    clientNonce: z
      .string()
      .trim()
      .min(8, "A client nonce is required.")
      .max(80, "The client nonce is too long."),
  })
  .strict();

export type SubmitQuestionInput = z.infer<typeof submitQuestionSchema>;

export const moderateQuestionSchema = z
  .object({
    status: z.enum(HOST_MODERATION_ACTIONS),
  })
  .strict();

export type ModerateQuestionInput = z.infer<typeof moderateQuestionSchema>;

export const createAnswerSchema = z
  .object({
    answerText: trimmedString(2, 2000, "Answer"),
    answerLanguage: languageCodeSchema,
    isPinned: z.boolean().default(false),
  })
  .strict();

export type CreateAnswerInput = z.infer<typeof createAnswerSchema>;

export const historyQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type HistoryQuery = z.infer<typeof historyQuerySchema>;

/**
 * Translation input. The upper bound matches the free translation provider's
 * documented 500-byte query limit, so oversized text is rejected at the edge
 * with a clear message instead of failing inside the provider.
 */
export const translateRequestSchema = z
  .object({
    text: trimmedString(1, 500, "Text"),
    sourceLanguage: languageCodeSchema,
    targetLanguage: languageCodeSchema,
  })
  .strict();

export type TranslateRequestInput = z.infer<typeof translateRequestSchema>;

export const joinCodeSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9]{6,12}$/,
    "Join codes contain 6 to 12 letters and numbers.",
  )
  .transform((value) => value.toUpperCase());

export const idSchema = z.string().trim().min(1, "A valid id is required.");

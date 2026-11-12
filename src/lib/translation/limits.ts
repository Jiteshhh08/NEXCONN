/**
 * Shared translation limits.
 *
 * The configured providers cap the `q` parameter at 500 **bytes** (not
 * characters). Keeping the number in one browser-safe module lets the
 * validation schema, the provider adapter and the client control agree.
 */
export const TRANSLATION_MAX_TEXT_BYTES = 500;

/** Returns the number of UTF-8 bytes in `text`. */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

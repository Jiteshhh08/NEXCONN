import "server-only";

import { randomInt } from "node:crypto";

// No I, L, O, 0, or 1: easier to read from a projector and type on a phone.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 7;

export function generateJoinCode(): string {
  let code = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

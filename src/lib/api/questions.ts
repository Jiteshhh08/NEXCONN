import type { QuestionSummary } from "@/lib/room/types";

import { apiFetch } from "./client";

/**
 * Fetches the complete question board, following the server's cursor until
 * `nextCursor` is null.
 *
 * The API stays paginated so a very large room does not return an unbounded
 * response, but the room UI needs the whole board. Keeping the loop here means
 * both the host console and the student view share one implementation and can
 * never silently show only the first page.
 */
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

interface QuestionPage {
  questions: QuestionSummary[];
  nextCursor: string | null;
}

export async function fetchRoomQuestions(
  joinCode: string,
): Promise<QuestionSummary[]> {
  const questions = new Map<string, QuestionSummary>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);

    const data = await apiFetch<QuestionPage>(
      `/api/rooms/${encodeURIComponent(joinCode)}/questions?${params.toString()}`,
    );

    for (const question of data.questions) {
      questions.set(question.id, question);
    }

    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }

  return [...questions.values()];
}
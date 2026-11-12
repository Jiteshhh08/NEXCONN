"use client";

import { ArrowUp, Check, Languages, Loader2, Radio, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { useLiveRoom } from "@/client/chat/use-live-room";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ApiRequestError, apiFetch } from "@/lib/api/client";
import type { ChatConnectionConfig } from "@/lib/chat/contracts";
import {
  getLanguage,
  LANGUAGES,
  MODERATION_LABELS,
  type LanguageCode,
} from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import type { JoinedRoom, QuestionSummary } from "@/lib/room/types";

const POLL_INTERVAL_MS = 6000;

/**
 * Matches `translateRequestSchema`. Text above this length is rejected at the
 * edge, so the control tells the user instead of firing a doomed request.
 */
const TRANSLATION_TEXT_LIMIT = 500;

type TranslationState =
  | { status: "loading"; targetLanguage: LanguageCode }
  | {
      status: "done";
      targetLanguage: LanguageCode;
      text: string;
      provider: string;
    }
  | { status: "error"; targetLanguage: LanguageCode; message: string };

function messageFor(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Please try again.";
}

/**
 * Renders the outcome of a translation request. A `loading` state renders
 * nothing here because the button that started it already shows a spinner.
 * A failure is always stated explicitly — the original text is never
 * presented as though it were a translation.
 */
function TranslatedText({ state }: { state: TranslationState | undefined }) {
  if (!state || state.status === "loading") return null;

  if (state.status === "error") {
    return <p className="mt-2 text-xs font-medium text-danger">{state.message}</p>;
  }

  const language = getLanguage(state.targetLanguage);

  return (
    <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="text-xs font-semibold text-primary-strong">
        Translated to {language.label}
        <span className="ml-1 font-normal text-muted-foreground">
          via {state.provider}
        </span>
      </p>
      <p
        lang={state.targetLanguage}
        dir={language.direction}
        className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground"
      >
        {state.text}
      </p>
    </div>
  );
}

/**
 * Student experience for an open room: join once, then ask questions and
 * upvote the ones already on the board.
 *
 * Every mutation goes through the database API, which is the source of truth.
 * The live channel is polled through the API on an interval, and the Nexconn
 * transport additionally nudges the board to refresh the moment an event
 * arrives. If the live connection is unavailable the board still works.
 */
export function JoinRoomClient({
  joinCode,
  hostLanguage,
}: {
  joinCode: string;
  hostLanguage: string;
}) {
  const [joined, setJoined] = useState<JoinedRoom | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [preferredLanguage, setPreferredLanguage] =
    useState<LanguageCode>(hostLanguage as LanguageCode);
  const [joinAnonymous, setJoinAnonymous] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [askAnonymous, setAskAnonymous] = useState(false);
  const [busy, setBusy] = useState<"join" | "ask" | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [translationTarget, setTranslationTarget] = useState<LanguageCode>(
    hostLanguage as LanguageCode,
  );
  const [translations, setTranslations] = useState<
    Record<string, TranslationState>
  >({});

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ questions: QuestionSummary[] }>(
        `/api/rooms/${joinCode}/questions`,
      );
      setQuestions(data.questions);
    } catch {
      // Transient failures are retried by the next poll.
    }
  }, [joinCode]);

  /**
   * A reload must not push the student back to the join form. The session
   * cookie survives the refresh, so ask the server whether this browser is
   * already a participant of the room and restore that identity instead of
   * joining again (which would be a pointless write, never a new participant).
   */
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const data = await apiFetch<JoinedRoom>(
          `/api/rooms/${joinCode}/session`,
        );
        if (!active) return;
        setJoined(data);
        setAskAnonymous(data.participant.isAnonymous);
        setPreferredLanguage(
          data.participant.preferredLanguage as LanguageCode,
        );
        setTranslationTarget(
          data.participant.preferredLanguage as LanguageCode,
        );
      } catch {
        // Not a participant yet (or the session expired) — show the join form.
      } finally {
        if (active) setRestoring(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [joinCode]);

  useEffect(() => {
    if (!joined) return;
    const kick = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [joined, refresh]);

  const connectionConfig = useMemo<ChatConnectionConfig | null>(() => {
    if (!joined || joined.chat.provider !== "nexconn") return null;
    return {
      appKey: joined.chat.appKey,
      token: joined.chat.token,
      userId: joined.chat.userId,
      channelId: joined.chat.channelId,
      roomId: joined.room.id,
      provider: joined.chat.provider,
    };
  }, [joined]);

  const { status: liveStatus } = useLiveRoom(connectionConfig, () => {
    void refresh();
  });

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("join");
    setError(null);
    try {
      const name = displayName.trim();
      const data = await apiFetch<JoinedRoom>(`/api/rooms/${joinCode}/join`, {
        method: "POST",
        body: JSON.stringify({
          displayName: name.length > 0 ? name : undefined,
          preferredLanguage,
          isAnonymous: joinAnonymous,
        }),
      });
      setJoined(data);
      setAskAnonymous(data.participant.isAnonymous);
      setPreferredLanguage(data.participant.preferredLanguage as LanguageCode);
      setTranslationTarget(data.participant.preferredLanguage as LanguageCode);
    } catch (joinError) {
      setError(messageFor(joinError));
    } finally {
      setBusy(null);
    }
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joined) return;

    const text = questionText.trim();
    if (text.length < 3) {
      setError("Write a question of at least 3 characters.");
      return;
    }

    setBusy("ask");
    setError(null);
    setNotice(null);
    try {
      const data = await apiFetch<{ question: QuestionSummary }>(
        `/api/rooms/${joinCode}/questions`,
        {
          method: "POST",
          body: JSON.stringify({
            text,
            sourceLanguage: joined.participant.preferredLanguage,
            isAnonymous: askAnonymous,
            clientNonce: crypto.randomUUID(),
          }),
        },
      );
      setQuestionText("");
      setNotice("Your question is with the host for review.");
      setQuestions((current) => [
        data.question,
        ...current.filter((item) => item.id !== data.question.id),
      ]);
    } catch (askError) {
      setError(messageFor(askError));
    } finally {
      setBusy(null);
    }
  }

  async function handleVote(question: QuestionSummary) {
    const nextVoted = !question.hasVoted;
    setVotingId(question.id);
    setError(null);

    setQuestions((current) =>
      current.map((item) =>
        item.id === question.id
          ? {
              ...item,
              hasVoted: nextVoted,
              upvoteCount: Math.max(0, item.upvoteCount + (nextVoted ? 1 : -1)),
            }
          : item,
      ),
    );

    try {
      const data = await apiFetch<{ upvoteCount: number | null }>(
        `/api/questions/${question.id}/votes`,
        { method: nextVoted ? "POST" : "DELETE" },
      );
      if (typeof data.upvoteCount === "number") {
        setQuestions((current) =>
          current.map((item) =>
            item.id === question.id
              ? { ...item, upvoteCount: data.upvoteCount as number, hasVoted: nextVoted }
              : item,
          ),
        );
      }
    } catch (voteError) {
      setQuestions((current) =>
        current.map((item) =>
          item.id === question.id
            ? {
                ...item,
                hasVoted: question.hasVoted,
                upvoteCount: question.upvoteCount,
              }
            : item,
        ),
      );
      setError(messageFor(voteError));
    } finally {
      setVotingId(null);
    }
  }

  /**
   * Translates one piece of room text into the viewer's chosen language.
   *
   * `/api/translate` only answers 200 when the configured provider returned a
   * real translation, so a failure is surfaced as an error message instead of
   * quietly showing the original text as if it had been translated.
   */
  async function handleTranslate(
    key: string,
    text: string,
    sourceLanguage: string,
  ) {
    if (text.length > TRANSLATION_TEXT_LIMIT) {
      setTranslations((current) => ({
        ...current,
        [key]: {
          status: "error",
          targetLanguage: translationTarget,
          message: `This text is longer than ${TRANSLATION_TEXT_LIMIT} characters, so it cannot be translated.`,
        },
      }));
      return;
    }

    setTranslations((current) => ({
      ...current,
      [key]: { status: "loading", targetLanguage: translationTarget },
    }));

    try {
      const data = await apiFetch<{
        translation: { translatedText: string; provider: string };
      }>("/api/translate", {
        method: "POST",
        body: JSON.stringify({
          text,
          sourceLanguage,
          targetLanguage: translationTarget,
        }),
      });
      setTranslations((current) => ({
        ...current,
        [key]: {
          status: "done",
          targetLanguage: translationTarget,
          text: data.translation.translatedText,
          provider: data.translation.provider,
        },
      }));
    } catch (translateError) {
      setTranslations((current) => ({
        ...current,
        [key]: {
          status: "error",
          targetLanguage: translationTarget,
          message: messageFor(translateError),
        },
      }));
    }
  }

  if (restoring) {
    return (
      <Card className="p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.025em]">
          Reconnecting you to this room
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Checking whether you are already taking part in this room…
        </p>
      </Card>
    );
  }

  if (!joined) {
    return (
      <Card className="p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.025em]">
          Join this room
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Pick the language you think in. Your questions are delivered to the
          host, who will answer in the room.
        </p>

        {error ? (
          <Alert tone="danger" className="mt-5" title="We could not join you">
            {error}
          </Alert>
        ) : null}

        <form className="mt-6 space-y-5" onSubmit={handleJoin}>
          <Field
            label="Your name (optional)"
            htmlFor="displayName"
            hint="Leave it blank to join as a guest."
          >
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              maxLength={40}
              placeholder="e.g. Priya"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Field>

          <Field label="Language you ask in" htmlFor="preferredLanguage">
            <Select
              id="preferredLanguage"
              name="preferredLanguage"
              value={preferredLanguage}
              onChange={(event) =>
                setPreferredLanguage(event.target.value as LanguageCode)
              }
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label} ({language.nativeLabel})
                </option>
              ))}
            </Select>
          </Field>

          <label className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-3.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--color-primary)]"
              checked={joinAnonymous}
              onChange={(event) => setJoinAnonymous(event.target.checked)}
            />
            <span>
              <span className="font-medium">Join anonymously</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                The host will not see your name on the questions you ask.
              </span>
            </span>
          </label>

          <Button type="submit" size="lg" disabled={busy === "join"}>
            {busy === "join" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Check aria-hidden="true" className="size-4" />
            )}
            Enter the room
          </Button>
        </form>
      </Card>
    );
  }

  const statusLabel =
    liveStatus === "live"
      ? "Live"
      : liveStatus === "connecting"
        ? "Connecting"
        : liveStatus === "error"
          ? "Offline"
          : "Polling";

  const targetLanguage = getLanguage(translationTarget);

  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.025em]">
              Ask the host
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You are asking in{" "}
              <span className="font-medium text-foreground">
                {getLanguage(joined.participant.preferredLanguage).label}
              </span>
              .
            </p>
          </div>
          <Badge tone={liveStatus === "live" ? "success" : "outline"}>
            <Radio aria-hidden="true" className="size-3.5" />
            {statusLabel}
          </Badge>
        </div>

        {error ? (
          <Alert tone="danger" className="mt-5" title="That did not work">
            {error}
          </Alert>
        ) : null}
        {notice ? (
          <Alert tone="success" className="mt-5" title="Question submitted">
            {notice}
          </Alert>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={handleAsk}>
          <Field label="Your question" htmlFor="questionText">
            <Textarea
              id="questionText"
              name="questionText"
              maxLength={1000}
              placeholder="What would you like the host to explain?"
              value={questionText}
              onChange={(event) => setQuestionText(event.target.value)}
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-primary)]"
                checked={askAnonymous}
                onChange={(event) => setAskAnonymous(event.target.checked)}
              />
              Ask anonymously
            </label>
            <Button type="submit" disabled={busy === "ask"}>
              {busy === "ask" ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Send aria-hidden="true" className="size-4" />
              )}
              Send question
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
              Room board
            </h2>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {questions.length}{" "}
              {questions.length === 1 ? "question" : "questions"}
            </p>
          </div>
          <div className="w-full sm:w-60">
            <Field
              label="Translate into"
              htmlFor="translationTarget"
              hint="Translations are produced by the provider configured on the server."
            >
              <Select
                id="translationTarget"
                name="translationTarget"
                value={translationTarget}
                onChange={(event) =>
                  setTranslationTarget(event.target.value as LanguageCode)
                }
              >
                {LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label} ({language.nativeLabel})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {questions.length === 0 ? (
            <Alert tone="info" title="No questions yet">
              Be the first to ask. Approved questions and your own questions
              appear here.
            </Alert>
          ) : (
            questions.map((question) => {
              const language = getLanguage(question.sourceLanguage);
              const isOwn =
                joined.participant.userId === question.askedByUserId;
              const canVote = question.moderationStatus === "approved";
              const questionTranslation = translations[question.id];
              const answerKey = `${question.id}:answer`;
              const answerTranslation = translations[answerKey];

              return (
                <article
                  key={question.id}
                  className="rounded-2xl border border-border bg-background/60 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">
                      <Languages aria-hidden="true" className="size-3" />
                      {language.label}
                    </Badge>
                    {question.isAnonymous ? (
                      <Badge tone="outline">Anonymous</Badge>
                    ) : null}
                    {question.moderationStatus !== "approved" ? (
                      <Badge
                        tone={
                          question.moderationStatus === "pending"
                            ? "warning"
                            : "outline"
                        }
                      >
                        {MODERATION_LABELS[question.moderationStatus]}
                      </Badge>
                    ) : null}
                    {isOwn ? <Badge tone="primary">Yours</Badge> : null}
                  </div>

                  <p
                    lang={language.code}
                    dir={language.direction}
                    className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground"
                  >
                    {question.originalText}
                  </p>

                  {question.sourceLanguage !== translationTarget ? (
                    <div className="mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={questionTranslation?.status === "loading"}
                        onClick={() =>
                          void handleTranslate(
                            question.id,
                            question.originalText,
                            question.sourceLanguage,
                          )
                        }
                      >
                        {questionTranslation?.status === "loading" ? (
                          <Loader2
                            aria-hidden="true"
                            className="size-4 animate-spin"
                          />
                        ) : (
                          <Languages aria-hidden="true" className="size-4" />
                        )}
                        Translate to {targetLanguage.label}
                      </Button>
                    </div>
                  ) : null}

                  <TranslatedText state={questionTranslation} />

                  {question.answer ? (
                    <div className="mt-3 rounded-xl border border-success/25 bg-success/5 p-3">
                      <p className="text-xs font-semibold text-success">
                        Host answered
                      </p>
                      <p
                        lang={question.answer.answerLanguage}
                        dir={getLanguage(question.answer.answerLanguage).direction}
                        className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/90"
                      >
                        {question.answer.answerText}
                      </p>
                      {question.answer.answerLanguage !== translationTarget ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={answerTranslation?.status === "loading"}
                          onClick={() =>
                            void handleTranslate(
                              answerKey,
                              question.answer!.answerText,
                              question.answer!.answerLanguage,
                            )
                          }
                        >
                          {answerTranslation?.status === "loading" ? (
                            <Loader2
                              aria-hidden="true"
                              className="size-4 animate-spin"
                            />
                          ) : (
                            <Languages aria-hidden="true" className="size-4" />
                          )}
                          Translate answer
                        </Button>
                      ) : null}
                      <TranslatedText state={answerTranslation} />
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(question.createdAt)}
                    </span>
                    <Button
                      variant={question.hasVoted ? "primary" : "secondary"}
                      size="sm"
                      disabled={!canVote || votingId === question.id}
                      aria-pressed={question.hasVoted}
                      title={
                        canVote
                          ? undefined
                          : "Only approved questions can be upvoted."
                      }
                      onClick={() => void handleVote(question)}
                    >
                      <ArrowUp aria-hidden="true" className="size-4" />
                      {question.upvoteCount}
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

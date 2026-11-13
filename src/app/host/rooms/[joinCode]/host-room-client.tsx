"use client";

import {
  Check,
  EyeOff,
  Languages,
  Loader2,
  Radio,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { useLiveRoom } from "@/client/chat/use-live-room";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/input";
import { ApiRequestError, apiFetch } from "@/lib/api/client";
import { fetchRoomQuestions } from "@/lib/api/questions";
import type { ChatConnectionConfig } from "@/lib/chat/contracts";
import {
  getLanguage,
  LANGUAGES,
  MODERATION_LABELS,
  type HostModerationAction,
  type LanguageCode,
  type RoomStatus,
} from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import type {
  AnswerSummary,
  QuestionSummary,
  RoomChatSession,
} from "@/lib/room/types";

const POLL_INTERVAL_MS = 6000;

function messageFor(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Please try again.";
}

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  approved: 1,
  hidden: 2,
  rejected: 3,
};

/**
 * Host console: review incoming questions, answer the ones the room sees, and
 * close the session. All state changes go through the owner-only API routes;
 * the database remains the source of truth and the live channel only makes the
 * screen refresh sooner.
 */
export function HostRoomClient({
  roomId,
  joinCode,
  hostLanguage,
  initialStatus,
}: {
  roomId: string;
  joinCode: string;
  hostLanguage: string;
  initialStatus: RoomStatus;
}) {
  const [status, setStatus] = useState<RoomStatus>(initialStatus);
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [chat, setChat] = useState<RoomChatSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [answerLanguage, setAnswerLanguage] =
    useState<LanguageCode>(hostLanguage as LanguageCode);
  const [answerPinned, setAnswerPinned] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const questions = await fetchRoomQuestions(joinCode);
      setQuestions(questions);
    } catch {
      // Transient failures are retried by the next poll.
    }
  }, [joinCode]);

  useEffect(() => {
    const kick = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (initialStatus !== "active") return;
    let active = true;
    void (async () => {
      try {
        const data = await apiFetch<{ chat: RoomChatSession }>(
          `/api/rooms/${joinCode}/chat-token`,
          { method: "POST" },
        );
        if (active) setChat(data.chat);
      } catch {
        // The console still works through polling without a live connection.
      }
    })();
    return () => {
      active = false;
    };
  }, [joinCode, initialStatus]);

  const connectionConfig = useMemo<ChatConnectionConfig | null>(() => {
    if (!chat || chat.provider !== "nexconn") return null;
    return {
      appKey: chat.appKey,
      token: chat.token,
      userId: chat.userId,
      channelId: chat.channelId,
      roomId,
      provider: chat.provider,
    };
  }, [chat, roomId]);

  const { status: liveStatus } = useLiveRoom(connectionConfig, (event) => {
    if (event.type === "room.closed") {
      setStatus("closed");
      setAnswerFor(null);
    }
    void refresh();
  });

  async function handleModerate(
    question: QuestionSummary,
    action: HostModerationAction,
  ) {
    setBusyId(question.id);
    setError(null);
    try {
      const data = await apiFetch<{ question: QuestionSummary }>(
        `/api/questions/${question.id}/moderation`,
        { method: "PATCH", body: JSON.stringify({ status: action }) },
      );
      setQuestions((current) =>
        current.map((item) =>
          item.id === question.id ? data.question : item,
        ),
      );
    } catch (moderationError) {
      setError(messageFor(moderationError));
    } finally {
      setBusyId(null);
    }
  }

  function openAnswer(question: QuestionSummary) {
    setAnswerFor(question.id);
    setAnswerText("");
    setAnswerLanguage(hostLanguage as LanguageCode);
    setAnswerPinned(false);
  }

  async function handleAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answerFor) return;

    const text = answerText.trim();
    if (text.length < 2) {
      setError("Write an answer of at least 2 characters.");
      return;
    }

    setBusyId(answerFor);
    setError(null);
    setNotice(null);
    try {
      const data = await apiFetch<{ answer: AnswerSummary }>(
        `/api/questions/${answerFor}/answers`,
        {
          method: "POST",
          body: JSON.stringify({
            answerText: text,
            answerLanguage,
            isPinned: answerPinned,
          }),
        },
      );
      const questionId = answerFor;
      setQuestions((current) =>
        current.map((item) =>
          item.id === questionId
            ? { ...item, answers: [data.answer, ...item.answers] }
            : item,
        ),
      );
      setAnswerFor(null);
      setAnswerText("");
      setNotice("Answer published to the room.");
    } catch (answerError) {
      setError(messageFor(answerError));
    } finally {
      setBusyId(null);
    }
  }

  async function handleClose() {
    if (!window.confirm("Close this room? Students can no longer join or ask.")) {
      return;
    }
    setClosing(true);
    setError(null);
    try {
      await apiFetch(`/api/rooms/${joinCode}/close`, { method: "POST" });
      setStatus("closed");
      setAnswerFor(null);
      await refresh();
    } catch (closeError) {
      setError(messageFor(closeError));
    } finally {
      setClosing(false);
    }
  }

  const ordered = [...questions].sort(
    (a, b) =>
      (STATUS_ORDER[a.moderationStatus] ?? 9) -
      (STATUS_ORDER[b.moderationStatus] ?? 9),
  );
  const pendingCount = questions.filter(
    (question) => question.moderationStatus === "pending",
  ).length;

  const liveLabel =
    liveStatus === "live"
      ? "Live"
      : liveStatus === "connecting"
        ? "Connecting"
        : liveStatus === "error"
          ? "Offline"
          : "Polling";

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-start">
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
                Question queue
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {pendingCount} awaiting review · {questions.length} total
              </p>
            </div>
            <Badge tone={liveStatus === "live" ? "success" : "outline"}>
              <Radio aria-hidden="true" className="size-3.5" />
              {liveLabel}
            </Badge>
          </div>

          {error ? (
            <Alert tone="danger" className="mt-5" title="That did not work">
              {error}
            </Alert>
          ) : null}
          {notice ? (
            <Alert tone="success" className="mt-5" title="Done">
              {notice}
            </Alert>
          ) : null}
          {status === "closed" ? (
            <Alert tone="warning" className="mt-5" title="Room closed">
              New questions and votes are no longer accepted.
            </Alert>
          ) : null}

          <div className="mt-5 space-y-3">
            {ordered.length === 0 ? (
              <Alert tone="info" title="No questions yet">
                Questions appear here the moment a student submits one.
              </Alert>
            ) : (
              ordered.map((question) => {
                const language = getLanguage(question.sourceLanguage);
                const isPending = question.moderationStatus === "pending";
                const isAnswered = question.answers.length > 0;

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
                      <Badge
                        tone={
                          question.moderationStatus === "approved"
                            ? "success"
                            : isPending
                              ? "warning"
                              : "outline"
                        }
                      >
                        {MODERATION_LABELS[question.moderationStatus]}
                      </Badge>
                      {question.isAnonymous ? (
                        <Badge tone="outline">Anonymous</Badge>
                      ) : null}
                      <Badge tone="primary">{question.upvoteCount} votes</Badge>
                      {isAnswered ? (
                        <Badge tone="accent">Answered</Badge>
                      ) : null}
                    </div>

                    {question.askedByName ? (
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        Asked by {question.askedByName}
                      </p>
                    ) : null}

                    <p
                      lang={language.code}
                      dir={language.direction}
                      className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground"
                    >
                      {question.originalText}
                    </p>

                    {question.answers.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {question.answers.map((answer) => (
                          <div
                            key={answer.id}
                            className="rounded-xl border border-success/25 bg-success/5 p-3"
                          >
                            <p className="text-xs font-semibold text-success">
                              Your answer
                            </p>
                            <p
                              lang={answer.answerLanguage}
                              dir={
                                getLanguage(answer.answerLanguage).direction
                              }
                              className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/90"
                            >
                              {answer.answerText}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {isPending ? (
                        <Button
                          size="sm"
                          disabled={busyId === question.id}
                          onClick={() => void handleModerate(question, "approved")}
                        >
                          <Check aria-hidden="true" className="size-4" />
                          Approve
                        </Button>
                      ) : null}
                      {question.moderationStatus === "approved" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busyId === question.id}
                          onClick={() => void handleModerate(question, "hidden")}
                        >
                          <EyeOff aria-hidden="true" className="size-4" />
                          Hide
                        </Button>
                      ) : null}
                      {question.moderationStatus !== "rejected" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === question.id}
                          onClick={() => void handleModerate(question, "rejected")}
                        >
                          <X aria-hidden="true" className="size-4" />
                          Reject
                        </Button>
                      ) : null}
                      {status === "active" ? (
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={() => openAnswer(question)}
                        >
                          <Send aria-hidden="true" className="size-4" />
                          {isAnswered ? "Answer again" : "Answer"}
                        </Button>
                      ) : null}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatDateTime(question.createdAt)}
                      </span>
                    </div>

                    {answerFor === question.id ? (
                      <form
                        className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4"
                        onSubmit={handleAnswer}
                      >
                        <Field
                          label="Your answer"
                          htmlFor={`answer-${question.id}`}
                        >
                          <Textarea
                            id={`answer-${question.id}`}
                            maxLength={2000}
                            placeholder="Explain it for the room…"
                            value={answerText}
                            onChange={(event) =>
                              setAnswerText(event.target.value)
                            }
                          />
                        </Field>
                        <Field
                          label="Answer language"
                          htmlFor={`answer-language-${question.id}`}
                        >
                          <Select
                            id={`answer-language-${question.id}`}
                            value={answerLanguage}
                            onChange={(event) =>
                              setAnswerLanguage(
                                event.target.value as LanguageCode,
                              )
                            }
                          >
                            {LANGUAGES.map((option) => (
                              <option key={option.code} value={option.code}>
                                {option.label} ({option.nativeLabel})
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <label className="flex items-center gap-2.5 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--color-primary)]"
                            checked={answerPinned}
                            onChange={(event) =>
                              setAnswerPinned(event.target.checked)
                            }
                          />
                          Pin this answer
                        </label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={busyId === question.id}
                          >
                            {busyId === question.id ? (
                              <Loader2
                                aria-hidden="true"
                                className="size-4 animate-spin"
                              />
                            ) : (
                              <Send aria-hidden="true" className="size-4" />
                            )}
                            Publish answer
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setAnswerFor(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Manage the room</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Closing ends joining, questions and votes. History stays available.
          </p>
          <Button
            variant="danger"
            size="sm"
            className="mt-4 w-full"
            disabled={status === "closed" || closing}
            onClick={() => void handleClose()}
          >
            {closing ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <ShieldCheck aria-hidden="true" className="size-4" />
            )}
            {status === "closed" ? "Room closed" : "Close room"}
          </Button>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Moderation tip</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Approve a question to place it on the student board and allow
            upvotes. Hide or reject to keep the room focused.
          </p>
        </Card>
      </div>
    </div>
  );
}

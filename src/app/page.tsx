import {
  ArrowRight,
  BadgeCheck,
  Check,
  History,
  Languages,
  MessageSquareText,
  QrCode,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Vote,
} from "lucide-react";
import Link from "next/link";

import { HeroPreview } from "@/components/marketing/hero-preview";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LANGUAGES } from "@/lib/domain";

const steps = [
  {
    number: "01",
    title: "Open the room",
    description:
      "The host creates a room, chooses the host language, and gets a join link with a QR code.",
  },
  {
    number: "02",
    title: "Join in one scan",
    description:
      "Students open the link in any browser, pick a language they think in, and step into the room.",
  },
  {
    number: "03",
    title: "Ask and upvote",
    description:
      "Questions arrive live. Students upvote what matters, and the host sees a moderated queue.",
  },
  {
    number: "04",
    title: "Answer once",
    description:
      "The host answers in their language. Students read the answer in theirs, with the original always available.",
  },
];

const features = [
  {
    icon: Languages,
    title: "Language-first asking",
    description:
      "Students write in Marathi, Hindi, Gujarati, Tamil, and more — not in a language they are still learning.",
  },
  {
    icon: QrCode,
    title: "One scan to join",
    description:
      "No app store, no account setup. A room link and a browser are enough to take part.",
  },
  {
    icon: ShieldCheck,
    title: "Moderation that keeps up",
    description:
      "Approve, hide, or reject questions before they reach the room board. The host stays in control.",
  },
  {
    icon: Vote,
    title: "Votes you can trust",
    description:
      "Votes live in the application database, with server-side checks and one vote per participant per question.",
  },
  {
    icon: MessageSquareText,
    title: "Answers that travel",
    description:
      "The lecturer answers once. Translation brings the answer into each student's preferred language.",
  },
  {
    icon: History,
    title: "Refresh-safe history",
    description:
      "Room, question, vote, and answer records are persisted, so reconnecting restores the conversation.",
  },
];

const hostPoints = [
  "See incoming questions in the host language.",
  "Approve, hide, or reject before the room sees them.",
  "Answer once and let translation carry the message.",
  "Pin the answers that matter and close the room when done.",
];

export default function HomePage() {
  const languageChips = LANGUAGES.filter(
    (language) => language.code !== "en",
  ).slice(0, 8);

  return (
    <>
      <section className="page-aurora relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid-paper opacity-35 [mask-image:linear-gradient(to_bottom,black,transparent_78%)]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24 lg:pt-20">
          <div>
            <Badge tone="primary" className="px-3 py-1.5">
              <Sparkles aria-hidden="true" className="size-3.5" />
              Multilingual live Q&amp;A
            </Badge>

            <h1 className="mt-6 max-w-2xl font-display text-[2.65rem] font-semibold leading-[1.02] tracking-[-0.035em] text-foreground sm:text-[4.1rem]">
              Ask in your language.
              <span className="mt-1 block text-primary">
                Understand in yours.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Vaani Room gives every student a way into the conversation. Join
              from a browser, ask in the language you think in, and let the
              room meet you there.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/host"
                className={buttonVariants({ size: "lg" })}
              >
                Host a room
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/join"
                className={buttonVariants({
                  variant: "secondary",
                  size: "lg",
                })}
              >
                Join a room
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
              {[
                "No app install",
                "Host-controlled queue",
                "Refresh-safe history",
              ].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check aria-hidden="true" className="size-3.5 text-primary" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-wrap items-center gap-2">
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Built for
              </span>
              {languageChips.map((language) => (
                <span
                  key={language.code}
                  lang={language.code}
                  className="rounded-full border border-border/80 bg-card/70 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {language.nativeLabel}
                </span>
              ))}
              <span className="text-xs text-muted-foreground">and more</span>
            </div>
          </div>

          <HeroPreview />
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/40">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 sm:grid-cols-3 sm:px-8">
          {[
            {
              icon: BadgeCheck,
              title: "Designed for the room",
              copy: "A calm queue for the host, a clear board for students.",
            },
            {
              icon: Languages,
              title: "Translation with a fallback",
              copy: "Original text stays visible if translation is pending or unavailable.",
            },
            {
              icon: ThumbsUp,
              title: "Participation, not noise",
              copy: "Moderation and votes help the most useful questions rise.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">
                <item.icon aria-hidden="true" className="size-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.copy}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              How it works
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              From a raised hand to a shared understanding.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              The whole flow is built around one idea: the language a student
              asks in should not decide whether they get an answer.
            </p>
          </div>

          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <li
                key={step.number}
                className="relative rounded-3xl border border-border bg-card/70 p-6"
              >
                <span className="font-display text-3xl font-semibold text-primary/25">
                  {step.number}
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="features"
        className="scroll-mt-24 border-y border-border/60 bg-card/40"
      >
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                What is inside
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Small features, a very different room.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Translation coverage depends on the connected provider. Vaani
              Room always keeps the original message available.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="group rounded-3xl p-6 shadow-none transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-soft"
              >
                <span className="grid size-10 place-items-center rounded-2xl bg-primary/8 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="for-hosts" className="scroll-mt-24">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              For lecturers &amp; hosts
            </p>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Run the room, not five separate conversations.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
              Every question lands in one queue, in the language you teach in.
              You decide what the room sees, what gets answered first, and when
              the session ends.
            </p>

            <ul className="mt-7 space-y-3">
              {hostPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Check aria-hidden="true" className="size-3" />
                  </span>
                  <span className="leading-6 text-foreground/90">{point}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/host"
              className={buttonVariants({
                variant: "secondary",
                className: "mt-8",
              })}
            >
              Open the host workspace
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>

          <Card className="overflow-hidden rounded-[1.9rem] p-0">
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Live queue</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  PHYS-201 · Host language: English
                </p>
              </div>
              <Badge tone="success" className="gap-1.5">
                <span className="size-1.5 rounded-full bg-success" />
                Active
              </Badge>
            </div>

            <div className="space-y-2.5 p-4">
              {[
                {
                  language: "मराठी",
                  text: "तरंगलांबी आणि वारंवारता यांचा संबंध कसा सांगाल?",
                  translation:
                    "How would you explain the relationship between wavelength and frequency?",
                  votes: 12,
                  tone: "primary" as const,
                  status: "Approved",
                },
                {
                  language: "हिन्दी",
                  text: "प्रकाशाचा वेग माध्यमानुसार का बदलतो?",
                  translation:
                    "Why does the speed of light change depending on the medium?",
                  votes: 8,
                  tone: "accent" as const,
                  status: "Needs review",
                },
                {
                  language: "தமிழ்",
                  text: "ஒளிவிலகல் மற்றும் பிரதிபலிப்பு வேறுபாடு என்ன?",
                  translation:
                    "What is the difference between refraction and reflection?",
                  votes: 5,
                  tone: "success" as const,
                  status: "Approved",
                },
              ].map((question) => (
                <div
                  key={question.text}
                  className="rounded-2xl border border-border/80 bg-background/60 p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Badge tone="outline">{question.language}</Badge>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <ThumbsUp aria-hidden="true" className="size-3.5" />
                      {question.votes}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-6">
                    {question.translation}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <Badge tone={question.tone}>{question.status}</Badge>
                    <span className="text-[0.65rem] text-muted-foreground">
                      Answer
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-primary-foreground sm:px-12 sm:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full border border-primary-foreground/15"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 right-24 size-64 rounded-full bg-accent/20 blur-3xl"
          />
          <div className="relative grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
                Ready when the lecture starts
              </p>
              <h2 className="mt-3 max-w-lg font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Make room for every question.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-primary-foreground/80">
                Open a room, share the code, and let students ask in the
                language they are most comfortable using.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
              <Link
                href="/host"
                className={buttonVariants({
                  variant: "secondary",
                  size: "lg",
                  className:
                    "border-transparent bg-primary-foreground text-primary-strong hover:bg-white",
                })}
              >
                Host a room
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/join"
                className={buttonVariants({
                  variant: "ghost",
                  size: "lg",
                  className:
                    "border border-primary-foreground/25 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
                })}
              >
                Join a room
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

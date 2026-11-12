# Vaani Room — Implementation Notes

> **Document status:** Living implementation log (v0.1)
> **Companion documents:**
> [`docs/architecture.md`](./architecture.md) (proposed design),
> [`docs/nexconn-integration-contract.md`](./nexconn-integration-contract.md)
> (verified Nexconn contracts), [`TEAM_LEAD.md`](../TEAM_LEAD.md) (handoff).
>
> This file records **what is actually built**, where it lives, and which parts
> are still scaffolding. It does not restate the architecture diagrams; update
> those in `architecture.md` instead.

---

## 1. How to read the status labels

| Label | Meaning |
|---|---|
| **Built** | Implemented, typechecked, linted, tested, and building. |
| **Dev-only** | Working, but a development convenience — not the production path. |
| **Stubbed** | Deliberately honest about not being connected; returns an explicit "not available" result. |
| **Not built** | Planned but absent. |

Nothing in this project was exercised against a live Nexconn application until
the 2026-11-12 server-to-server probe (see
[`docs/nexconn-integration-contract.md`](./nexconn-integration-contract.md) §I),
which confirmed token issue, open-channel create, message send and destroy with
`code: 0`. The **browser** flow has still not been driven end to end, so the
student/host live relay is `NEEDS_VERIFICATION`.

---

## 2. Implemented surface

| Area | Status | Location |
|---|---|---|
| Next.js 16 App Router + TypeScript + Tailwind scaffold | Built | `src/app/`, `src/components/` |
| Prisma schema and initial SQLite migration | Built | `prisma/schema.prisma`, `prisma/migrations/` |
| Zod environment validation and startup enforcement | Built | `src/lib/env.ts`, `src/server/startup.ts`, `src/instrumentation.ts` |
| Shared API envelope, error codes and JSON parsing | Built | `src/lib/api/*` |
| Same-origin check for state-changing requests | Built | `src/lib/api/request.ts` |
| In-process fixed-window rate limiting | Built | `src/server/auth/rate-limit.ts` |
| Host auth: scrypt passwords, DB-backed sessions, HttpOnly cookie | Built | `src/server/auth/*`, `src/app/api/auth/*` |
| Room creation, join codes, QR share links | Built | `src/server/rooms/*`, `src/app/api/rooms/route.ts` |
| Health endpoint with a database probe | Built | `src/app/api/health/route.ts` |
| Chat provider seam (`ServerChatProvider` / `ChatClientTransport`) | Built | `src/lib/chat/contracts.ts` |
| Local development chat provider | Dev-only | `src/server/chat/local.ts` |
| Nexconn server chat adapter | Built (server endpoints live-probed) | `src/server/chat/nexconn.ts` |
| Nexconn signed server HTTP client | Built (server endpoints live-probed) | `src/server/nexconn/client.ts` |
| Nexconn request signing + webhook signature verification | Built | `src/server/nexconn/signing.ts`, `src/server/webhooks/signature.ts` |
| Live-event wire format over text messages | Built | `src/lib/chat/events.ts` |
| Browser Nexconn transport | Built — mounted in the room pages | `src/client/chat/nexconn.ts`, `src/client/chat/use-live-room.ts` |
| Room join route (guest identity + participant + token issuance) | Built (token issue live-probed) | `src/app/api/rooms/[joinCode]/join/route.ts` |
| Room session restore route (refresh keeps the student in the room) | Built (live-probed) | `src/app/api/rooms/[joinCode]/session/route.ts` |
| Shared join/session payload builder | Built | `src/server/rooms/joined.ts` |
| Host live token route (owner-only channel token) | Built | `src/app/api/rooms/[joinCode]/chat-token/route.ts` |
| Question ask/list routes (host all / student own+approved) | Built | `src/app/api/rooms/[joinCode]/questions/route.ts` |
| Vote routes (cast / remove, duplicate-safe) | Built | `src/app/api/questions/[questionId]/votes/route.ts` |
| Moderation + answer routes (owner-only) | Built | `src/app/api/questions/[questionId]/{moderation,answers}/route.ts` |
| Room close route | Built | `src/app/api/rooms/[joinCode]/close/route.ts` |
| Nexconn webhook receiver | Built (not live-tested — needs a public URL) | `src/app/api/webhooks/nexconn/route.ts` |
| Student room UI (join, restore on refresh, ask, upvote, live badge) | Built | `src/app/join/[code]/join-room-client.tsx` |
| Host room UI (moderation, answers, close, live badge) | Built | `src/app/host/rooms/[joinCode]/host-room-client.tsx` |
| Shared browser-safe room DTOs + API fetch helper | Built | `src/lib/room/types.ts`, `src/lib/api/client.ts` |
| Translation provider seam | Built | `src/lib/translation/contracts.ts`, `src/server/translation/index.ts` |
| Passthrough translation fallback | Dev-only | `src/server/translation/passthrough.ts` |
| LibreTranslate adapter | Stubbed | `src/server/translation/libretranslate.ts` |
| Nexconn server translation adapter | Stubbed (by design) | `src/server/translation/nexconn.ts` |
| MyMemory adapter (key-free real translation) | Built (logic unit-tested; reachability live-probed) | `src/lib/translation/mymemory.ts`, `src/server/translation/mymemory.ts` |
| Translation request route | Built | `src/app/api/translate/route.ts` |
| Translate control in the student room UI | Built (no browser verification) | `src/app/join/[code]/join-room-client.tsx` |

---

## 3. The provider seams

The domain code never talks to Nexconn directly. Two seams keep it swappable:

1. **`ServerChatProvider`** (`src/lib/chat/contracts.ts`) — server-side
   operations. Two implementations: `LocalChatProvider` (default) and
   `NexconnChatProvider`. Selected at runtime by
   `getChatProvider()` (`src/server/chat/index.ts`) from
   `NEXCONN_CHAT_PROVIDER`.
2. **`ChatClientTransport`** — browser-side transport. `NexconnChatTransport`
   wraps the `@nexconn/chat` Web SDK; the local SSE transport is still to be
   written.

`TranslationProvider` works the same way, selected by `TRANSLATION_PROVIDER`.

Provider modules import `server-only` so they cannot be pulled into a browser
bundle. `signing.ts` and `webhooks/signature.ts` are intentionally guard-free
because they take the secret as an argument and are covered by Node tests.

---

## 4. Nexconn wiring added in this pass

The full contract table with official sources lives in
[`docs/nexconn-integration-contract.md`](./nexconn-integration-contract.md).
This section records the code shape.

### 4.1 Signed server HTTP client — `src/server/nexconn/client.ts`

- `readNexconnCredentials()` throws `IntegrationNotConfiguredError` (503) when
  the App Key or App Secret is missing, instead of failing on the network.
- `resolveBaseUrls()` returns the configured regional host plus the documented
  `api-b.<region>` backup when the URL matches the published naming.
- `nexconnRequest(endpoint, body)` signs every request with
  `sha1(AppSecret + Nonce + Timestamp)` and the `App-Key` / `Nonce` /
  `Timestamp` / `Signature` headers, posts JSON, and unwraps `{ code, result }`.
  A 5-second timeout, a network error, or a 5xx response moves to the backup
  host; a non-zero Nexconn `code` is reported as a business error and does not
  fail over.

### 4.2 Server chat adapter — `src/server/chat/nexconn.ts`

| Method | Nexconn call |
|---|---|
| `createChannel` | `POST /v4/open-channel/create` |
| `closeChannel` | `POST /v4/open-channel/destroy` |
| `issueUserToken` | `POST /v4/auth/access-token/issue` |
| `publishEvent` | `POST /v4/open-channel/message/send` |

`channelIdForRoom(roomId)` reuses the Vaani room id as the open-channel id. The
docs publish no channel-id format, so this is flagged as an assumption.

Structured room events have nowhere to live on the server API (no metadata
field), so `publishEvent` serializes them with `encodeLiveEvent()` into the
text body.

### 4.3 Live-event wire format — `src/lib/chat/events.ts`

`encodeLiveEvent` / `decodeLiveEvent` wrap a `LiveEvent` with a `vaani.live-event`
marker inside the message text. Messages the browser sends attach the same
information as SDK metadata (`MESSAGE_METADATA_KEYS`), which the server API
cannot send but the client SDK can.

### 4.4 Browser transport — `src/client/chat/nexconn.ts`

`NexconnChatTransport implements ChatClientTransport`:

- Initializes `NCEngine` once, connects with the issued token, and enters the
  open channel;
- registers its message/translate handlers **idempotently**, so a retried
  `connect()` cannot deliver every message twice;
- sends a question as a text message with metadata;
- decodes inbound text messages back into `LiveEvent`s for `onEvent` listeners;
- exposes `translateMessage(...)`, which uses
  `NCEngine.translateModule.translateMessages` and turns
  `onTranslationCompleted` results into `translation.updated` events.

It is mounted through `src/client/chat/use-live-room.ts`, a hook that connects
only when the provider is `nexconn` and the App Key, token, user id and channel
id are all present; otherwise it stays `idle` and the room pages keep working
through polling. A failed connect is retried a **bounded** three more times
(1 s / 3 s / 7 s) with a single transport and a single listener registration;
after that the badge settles on "Offline" and the poll continues. Both the
student page (`src/app/join/[code]/join-room-client.tsx`)
and the host page (`src/app/host/rooms/[joinCode]/host-room-client.tsx`) use it.

### 4.5 Join + session routes

`POST /api/rooms/[joinCode]/join`
(`src/app/api/rooms/[joinCode]/join/route.ts`) validates the join code and body,
rate-limits by client key, resolves or creates a pseudonymous participant (a
guest `User` plus a `Participant` row and a session cookie), issues the Nexconn
token through the chat provider, and returns the room summary, participant
summary, and the chat connection config. The response contains the App Key and
the user token — never the App Secret. The `Participant` upsert is keyed on the
unique `(roomId, userId)`, so joining twice with the same browser session is a
no-op that cannot duplicate membership or inflate the participant count.

`GET /api/rooms/[joinCode]/session`
(`src/app/api/rooms/[joinCode]/session/route.ts`) restores that state after a
reload. The HttpOnly session cookie survives the refresh, so the route
re-resolves the participant from the cookie and re-issues a live-channel token.
It is read-only with respect to membership — it never creates a user or a
`Participant` — so refreshing cannot change the participant count. A caller
without a session gets `401`; a signed-in caller who is not a participant of
the room gets `403`; the checks stay on the server.

Both routes build their response through the shared
`src/server/rooms/joined.ts` helper so the two payloads cannot drift.

The host console obtains its own channel token from the owner-only
`POST /api/rooms/[joinCode]/chat-token` route
(`src/app/api/rooms/[joinCode]/chat-token/route.ts`) so it receives the same
live events students do.

### 4.5.1 Freshness of the room board

`src/lib/api/client.ts` sends every `apiFetch` request with `cache: "no-store"`,
and `apiSuccess` / `apiFailure` (`src/lib/api/response.ts`) set
`Cache-Control: no-store` on every response. The room board is a poll, so a
cached body would keep a freshly-published answer hidden until a full page
reload. With both sides uncached, the student board picks up a new answer on its
next poll (6 s) or immediately when the live transport requests a refresh.

### 4.6 Webhook receiver — `src/app/api/webhooks/nexconn/route.ts`

`POST` verifies the `AppKey` / `Nonce` / `Timestamp` / `Signature` headers
against the App Secret **before** parsing the body, rejects bad signatures with
401, validates the `{ type, id, time, data }` envelope, and stores the raw body
in `WebhookEvent` keyed by the unique `externalId`. Repeated deliveries return
200 with `duplicate: true`. Per-event payload interpretation is intentionally
not implemented yet.

### 4.7 Translation — `src/app/api/translate/route.ts`

`POST /api/translate` is the first code path that actually calls
`getTranslationProvider()`; before it, the provider seam was only referenced
from inside `src/server/translation/`. It:

1. enforces same-origin and requires a session (401 otherwise);
2. rate-limits per user (60 requests / 60 s → `RATE_LIMITED`);
3. validates `{ text (1–500 chars), sourceLanguage, targetLanguage }` with
   `translateRequestSchema` (`.strict()`, so unknown keys are rejected);
4. calls the configured provider and, **unless** the result is `ready` with
   non-empty text, throws `TRANSLATION_UNAVAILABLE` with HTTP **502**.

The 502 is deliberate: a `200` from this route always means a real translation
came back from the provider. The route never substitutes the original text, and
it never returns a credential. The provider name is echoed back
(`provider: "mymemory"` etc.) so the UI can state honestly where the text came
from.

Provider selection lives in `selectTranslationProvider`
(`src/lib/translation/contracts.ts`): `TRANSLATION_PROVIDER_NAMES` is the single
source of truth shared by the Zod enum in `src/lib/env.ts`, the factory in
`src/server/translation/index.ts`, and the tests. An unknown or unset value
falls back to `passthrough`, which is a **development/test mode**: same-language
requests succeed as a genuine no-op, and anything else is `unavailable` rather
than a fabricated translation.

`src/lib/translation/mymemory.ts` is the key-free adapter. It is a pure function
with injectable `fetch`, endpoint and timeout so every failure path (HTTP error,
network/timeout, unparsable body, exhausted quota, provider error status, empty
translation) is unit-tested without a network. The 500-character validation
bound matches MyMemory's documented 500-**byte** `q` limit; the adapter
re-checks the real byte length before calling out.

The student room UI renders a target-language `Select` in the board header and a
`Translate` action per question and per host answer. `loading`, `done` and
`error` are distinct states, the original text always stays visible, and a
failure is displayed as an error instead of being presented as a translation.

---

## 5. Conventions worth keeping

- **API envelope:** every route returns `{ ok: true, data }` or
  `{ ok: false, error: { code, message, details? } }` via
  `apiSuccess` / `apiFailure` / `apiError`. `apiError` maps `AppError`,
  `ZodError`, and Prisma `P2002`/`P2025` and logs anything else.
- **Validation:** request bodies are parsed with a Zod schema; invalid input
  becomes a 422 with `fieldErrors`.
- **Runtime:** routes that touch Prisma or secrets declare
  `runtime = "nodejs"` and `dynamic = "force-dynamic"`.
- **Secrets:** nothing sensitive may be referenced from a `NEXT_PUBLIC_*`
  variable or a client component. Provider modules carry `server-only`.
- **Honest failure:** when a capability is not connected, the code returns an
  explicit "unavailable"/"not configured" result rather than faking success.

---

## 6. Verification performed

Run from the repository root:

| Command | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run test` | pass — **76 tests / 14 suites / 0 fail** (validation 24, chat events 6, API client 4, translation 21, client IP 10, Nexconn signing 5, webhook signature 6) |
| `npm run build` | pass — Next.js 16.4.6; all routes emitted, including `/api/rooms/[joinCode]/{join,session,chat-token,questions,close}`, `/api/questions/[questionId]/{answers,moderation,votes}`, `/api/translate`, `/api/webhooks/nexconn`, `/join/[code]`, `/host/rooms/[joinCode]` |

These confirm the code matches its contracts and that the automated tests pass.
They do **not** prove the browser flow against a live account. The **server**
endpoints were separately live-probed on 2026-11-12 (`code: 0` on token issue,
channel create, message send, destroy) — see
[`docs/nexconn-integration-contract.md`](./nexconn-integration-contract.md) §I.

A second live probe on 2026-11-12 (real HTTP against the running dev server,
`NEXCONN_CHAT_PROVIDER=nexconn`) exercised the full answer path end to end:
register host → create room → join as a student (cookie jar) → ask → approve →
answer → **student `GET .../questions` returned the answer text**, with
`Cache-Control: no-store`. The same probe confirmed the session-restore route
returns the *same* participant id, that a cookie-less caller gets `401` and a
signed-in non-participant gets `403`, that re-joining with the same cookie keeps
the count at 1 (no duplicate participant), that a fresh cookie is a distinct
participant (count 2), and that a closed room rejects join and ask with
`409 ROOM_CLOSED`. Browser-level (GUI) confirmation of the same steps is still
outstanding — see the manual steps in the final report.

---

## 7. Known gaps

- The local SSE transport is still missing; `ChatClientTransport` has only the
  Nexconn implementation so far. When Nexconn is not configured the room pages
  fall back to polling rather than a live stream.
- Webhook events are archived, not interpreted.
- Server-side translation through **Nexconn** is not possible (its translation
  module is browser-SDK only), so `src/server/translation/nexconn.ts` stays
  honest about being unavailable. Real translation is served instead by the
  key-free `mymemory` provider (`TRANSLATION_PROVIDER="mymemory"`); the default
  remains `passthrough`, which is a development/test mode and never fabricates
  a translation.
- The browser relay (student ⇄ host over the live Open Channel) has not been
  driven against a live account, so it is `NEEDS_VERIFICATION` even though the
  server endpoints it depends on were live-probed. The room board therefore
  treats the 6 s poll as the guaranteed delivery path and the live channel only
  as an accelerator — if the live connection drops, the board still updates.
- `src/client/chat/use-live-room.ts` retries a failed live connect a bounded
  three times (1 s / 3 s / 7 s) using one transport and one listener
  registration, then settles on "Offline"; the board's data is never dependent
  on a live socket. It does not re-detect a drop *after* a successful connect.
- An in-flight poll can briefly overwrite the optimistic upvote count; the next
  poll (≤ 6 s) restores the authoritative value. Not observed as a defect.
- Every `NEEDS-CONSOLE-CONFIRMATION` item in the contract document is still open
  (token expiry, plan limits, translation enablement, webhook URL registration,
  per-event payload shapes).

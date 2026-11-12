# Vaani Room — Team Lead Handoff & Nexconn Integration Guide

> **Status:** Nexconn integration wiring complete and the **server-to-server
> endpoints live-probed** against the account's Singapore host on 2026-11-12
> (`LIVE-TESTED (probe)` — see
> [`docs/nexconn-integration-contract.md`](./docs/nexconn-integration-contract.md)
> §I). The **browser end-to-end smoke test has not been run**: it needs Console
> access, a public HTTPS origin, and two browser sessions. This document is the
> single checklist for the team lead to connect the real Nexconn application and
> take the project to production. Update it as each integration is verified.
>
> **Read this with:** [`README.md`](./README.md),
> [`docs/architecture.md`](./docs/architecture.md) (proposed design),
> [`docs/implementation-notes.md`](./docs/implementation-notes.md) (what is
> actually built) and
> [`docs/nexconn-integration-contract.md`](./docs/nexconn-integration-contract.md)
> (verified Nexconn contracts, with source links and status labels).
>
> **Status label vocabulary** used in the contract document: `VERIFIED`,
> `IMPLEMENTED`, `LIVE-TESTED`, `NEEDS-CONSOLE-CONFIRMATION`, `BLOCKED`,
> `UNVERIFIED`.

---

## 1. What is implemented right now

| Area | Status |
|---|---|
| Next.js 16 + TypeScript + Tailwind scaffold | ✅ Complete |
| Prisma schema for all documented entities and constraints | ✅ Complete |
| Local SQLite database + initial migration | ✅ Complete |
| Environment validation (Zod) and `.env.example` | ✅ Complete |
| Shared API envelope, error codes, request validators | ✅ Complete |
| Chat/translation provider contracts | ✅ Complete |
| Local dev chat provider + honest passthrough translation | ✅ Complete (preserved fallback) |
| Responsive marketing shell (`/`, `/host`, `/join`) | ✅ Complete |
| `GET /api/health` with database check | ✅ Complete |
| Nexconn signed server HTTP client (failover, timeouts) | ✅ Built — live-probed (SG host) |
| Nexconn server chat adapter (create/issue/publish/close) | ✅ Built — live-probed (all four endpoints `code: 0`) |
| Nexconn browser transport (`ChatClientTransport`) | ✅ Built — mounted in the student and host room pages |
| Session/token issuance route (`POST /api/rooms/[joinCode]/join`) | ✅ Built — token issue live-probed |
| Nexconn webhook receiver (verify → dedupe → ledger) | ✅ Built — not live-tested (needs a public URL) |
| Nexconn built-in translation adapter | ⏳ Stubbed (`unavailable`) — needs Console confirmation (§4.5) |
| Key-free translation (`mymemory` provider + `POST /api/translate` + student control) | ✅ Built — automated tests only; provider reachability live-probed, GUI **not** verified (§4.5) |
| Student & host live room UI (join, ask, vote, moderate, answer, close) | ✅ Built — mounted at `/join/[code]` and `/host/rooms/[joinCode]` |
| Test suite and production hardening | ✅ 76 tests passing (14 suites, 0 fail); hardening ongoing (§7) |

The application is deliberately runnable **without** Nexconn credentials:

- `NEXCONN_CHAT_PROVIDER="local"` uses a signed local token and (in Phase 3)
  an SSE development transport.
- `TRANSLATION_PROVIDER="passthrough"` never fabricates a translation. It
  returns `unavailable` and the UI keeps showing the original text.
- `TRANSLATION_PROVIDER="mymemory"` enables real translation with **no API
  key** (see §4.5).

These are development scaffolding, **not** a replacement for Nexconn in the
submitted product.

---

## 2. Stack and architecture decisions

| Decision | Choice | Reason |
|---|---|---|
| App framework | Next.js 16 App Router, React 19, TypeScript | One codebase for student and host routes; documented `/api/*` routes; server-only secret handling |
| Styling | Tailwind CSS 4 + local components | Responsive host/projector and student/mobile UI without a heavy UI kit |
| Database | Prisma + SQLite locally, Postgres-ready | No Docker on the current machine; production must move to Postgres |
| Validation | Zod 4 | Shared request contracts and typed errors |
| Auth (planned) | DB-backed sessions, HttpOnly cookies, scrypt hashes | Stable pseudonymous guest IDs; no external auth dependency |
| Real-time seam | `ServerChatProvider` / `ChatClientTransport` | Nexconn can be connected without touching domain logic |
| Translation seam | `TranslationProvider` | Mirrors Nexconn's asynchronous task/result model with a safe fallback |
| QR (planned) | `qrcode` package | Server-generated join QR codes |

The architecture document intentionally left the framework, database, and
hosting provider open. These choices are now recorded here and in the README.

---

## 3. Environment variables

Copy `.env.example` to `.env`. **Never commit `.env`.**

| Variable | Where it lives | Required for | Secret? |
|---|---|---|---|
| `APP_BASE_URL` | Server | Join links, QR destinations, webhook URL | No |
| `DATABASE_URL` | Server | Prisma database connection | Yes (production) |
| `SESSION_SECRET` | Server | Session cookies and local transport tokens | **Yes** |
| `TRUSTED_PROXY_HEADER` | Server | Client-IP header written by the deployment proxy | No |
| `TRUSTED_PROXY_HOPS` | Server | Number of trusted proxies in front of the app | No |
| `NEXCONN_APP_KEY` | Server now; safe public config later | Browser SDK initialization and token issuance | No |
| `NEXCONN_APP_SECRET` | **Server only** | Privileged Nexconn API calls **and webhook signature verification** | **YES — never expose** |
| `NEXCONN_API_BASE_URL` | Server | Nexconn server API base URL / region | No |
| `NEXCONN_CHAT_PROVIDER` | Server | `local` (dev) or `nexconn` | No |
| `TRANSLATION_PROVIDER` | Server | `passthrough` (default, dev/test), `mymemory`, `nexconn`, or `libretranslate` | No |
| `MYMEMORY_EMAIL` | Server | Optional contact address for the MyMemory provider (raises its anonymous daily quota). Not required. | No |
| `LIBRETRANSLATE_URL` | Server | Optional local/demo translation | No |
| `LIBRETRANSLATE_API_KEY` | Server | Optional LibreTranslate auth | **Yes** |
| `TRANSLATION_ENABLED` | **Unused** | Nothing reads it; the translate route is always available | No |
| `NEXCONN_WEBHOOK_SECRET` | **Unused** | Nothing reads it; webhooks are verified with `NEXCONN_APP_SECRET` | **Yes** |

Rules:

- Never create a `NEXT_PUBLIC_*` variable for the App Secret, database URL,
  webhook secret, or session secret.
- Nexconn webhooks are signed with the **same App Secret** (`sha1(AppSecret +
  Nonce + Timestamp)`); there is no separate webhook secret.
  `NEXCONN_WEBHOOK_SECRET` is **not** part of the Nexconn contract — it is left
  blank in `.env.example` only for deployments that may add one later, and the
  webhook receiver does not read it (verified: the receiver reads
  `NEXCONN_APP_SECRET`). `TRANSLATION_ENABLED` is likewise declared but never
  consumed; both are kept only so existing `.env` files stay valid.
- If a secret is ever pasted into chat, committed, or shared, rotate it in the
  Nexconn Console immediately.
- Use separate Nexconn applications/credentials for development and production.
- `src/lib/env.ts` rejects production startup when `SESSION_SECRET` is missing,
  and rejects `NEXCONN_CHAT_PROVIDER=nexconn` without the App Key/Secret. These
  runtime checks run from `src/instrumentation.ts`, so `next build` does not
  need deployment-only secrets.
- Rate limiting only trusts a client-IP header when `TRUSTED_PROXY_HEADER` is
  set to the header your proxy overwrites. Leave it `none` for direct exposure;
  never trust `x-forwarded-for` from arbitrary clients.

---

## 4. Values and documentation needed from the team lead

The integration is written against the public Nexconn documentation (see
[`docs/nexconn-integration-contract.md`](./docs/nexconn-integration-contract.md)
for the exact source links). Everything below is still required to go live;
item-by-item confirmations are also listed as open items in §7 of that
contract document. Put secrets directly into the local `.env` (or the
deployment secret manager) — do not send them in a group chat.

### 4.1 Nexconn application

- [ ] `NEXCONN_APP_KEY`
- [ ] `NEXCONN_APP_SECRET` (via secret manager only)
- [ ] `NEXCONN_API_BASE_URL` (exact base URL for the account's region — the
      Asia/Beijing host is **unconfirmed**; only the Singapore/global host
      pattern is documented)
- [ ] Nexconn plan name and environment (sandbox/staging/production)

### 4.2 Chat SDK

Already installed and verified against the shipped type declarations:
`@nexconn/chat@26.2.1` with peer `@nexconn/engine@26.2.1` (global
`NexconnChat`). The server and browser adapters are written against these
symbols. Still to confirm with a live account:

- [x] The Open Channel id rules the adapter assumes: `channelId = roomId`.
      **Resolved by live probe:** maximum length **64 characters**; mixed case,
      `-` and `_` accepted. The room id (lowercase alphanumeric cuid) is inside
      the bound.
- [x] Which `fromUserId` the server may use when publishing room events.
      **Resolved by live probe:** the unregistered id `vaaniSystem` is accepted
      (`code: 0`, one `messageId`).
- [ ] Timestamp validity window for signed requests (**unverified** — no window
      is enforced on inbound webhooks; the app sends the current time)
- [ ] Whether published text messages can carry the metadata the browser
      transport attaches (server bodies have no metadata field; structured
      events are encoded into the text body instead)
- [ ] Channel close/delete behaviour and any retention implications

### 4.3 User access tokens

Implemented against the documented `POST /v4/auth/access-token/issue` endpoint
(`{ userId, name }` → `{ userId, accessToken }`) and returned by
`POST /api/rooms/[joinCode]/join`. **Live-probed:** HTTP 200, `code 0`,
`result.userId` and a 96-character `result.accessToken` returned. Still to
confirm:

- [ ] Real token TTL. The docs state tokens are **indefinite by default** and the
      expiry is a **Console setting**; the adapter uses a 24-hour refresh hint
      only. **Ask the team lead:** what is this App Key's access-token expiry in
      Console → Chat → Chat settings?
- [ ] Required `userId` format (the docs allow letters and digits, max 64 bytes —
      the Vaani cuid passes through unchanged)
- [ ] Whether a per-user channel membership or join is required before the
      browser may enter the channel (the SDK's `enterChannel` is client-side
      only; no server join API is documented)

### 4.4 Webhooks

The receiver is implemented at `${APP_BASE_URL}/api/webhooks/nexconn`. It
verifies `sha1(AppSecret + Nonce + Timestamp)` from the `AppKey`, `Nonce`,
`Timestamp`, `Signature` headers **before** parsing the body, then dedupes on
the Nexconn event id. Still to confirm:

- [ ] Confirmation that webhooks can be configured for the account
- [ ] The exact event types to enable and one real payload per event type
      (redact secrets) — the receiver currently accepts any event and stores it
      in the ledger
- [ ] Retry policy and duplicate-delivery behaviour
- [ ] Whether the signature uses hex or base64 (the code assumes **hex**)
- [ ] Whether request bodies are gzipped

### 4.5 Translation

**Decision taken (2026-11-12):** the product now has a **working, key-free**
translation path so it does not depend on a Nexconn Console change:

- Provider order considered: (1) Nexconn built-in translation, (2) a legitimate
  key-free service, (3) LibreTranslate/another external provider.
- (1) was rejected as a **server-side** option: Nexconn's translation module is
  browser-SDK only (`@nexconn/chat`), and server-side translation is not
  documented, so `src/server/translation/nexconn.ts` stays an honest
  `unavailable`.
- (3) was rejected after a live probe: `translate.terraprint.co` returned
  **502** and `libretranslate.com` returned **400**, so no public instance is
  usable.
- (2) was chosen: the public **MyMemory** API answered `200` with a real
  Hindi translation for `en|hi` and requires **no API key**. It is implemented
  as `TRANSLATION_PROVIDER="mymemory"`.
- `TRANSLATION_PROVIDER="passthrough"` remains the **default** and is a
  **development/test mode**: it never fabricates a translation.
- No paid service was enabled and no billing was changed. `MYMEMORY_EMAIL` is
  optional and only raises the free anonymous quota.

To turn it on locally: set `TRANSLATION_PROVIDER="mymemory"` in `.env` and
restart the dev server. `POST /api/translate` returns `502
TRANSLATION_UNAVAILABLE` (never the original text) whenever the provider cannot
translate.

Still open with the team lead — built-in translation is **disabled by default**
in the current Nexconn docs, and the Console must confirm it is enabled if the
Nexconn path is ever wanted.

- [ ] Translation enabled for the application
- [ ] Nexconn language code format (ISO 639-1 vs provider-specific)
- [ ] Mapping for: English, Hindi, Marathi, Gujarati, Tamil, Telugu, Bengali,
      Kannada, Malayalam, Punjabi, Odia, Urdu
- [ ] Translation request/task trigger call
- [ ] Async translation result event name and payload shape
- [ ] Whether translation is requested per message or per viewer
- [ ] Translation quota and billing behavior
- [ ] Known language-pair limitations

### 4.6 Plan limits

- [ ] Concurrent Open Channel limit on the plan
- [ ] Message rate limit
- [ ] Translation allowance / overage behavior
- [ ] Open Channel message retention (the docs currently say cloud retention is
      disabled by default)
- [ ] Any sandbox restrictions

---

## 5. Nexconn Console setup checklist

Verify each step against the Console version the team actually has.

1. **Create or confirm the Nexconn application.**
   Record the App Key and store the App Secret in the team password manager.
2. **Enable Chat / Open Channels.**
   Confirm the account plan allows the expected number of concurrent channels.
3. **Enable built-in translation.**
   Add every language pair the demo will use. Test Marathi → English and
   English → Marathi first.
4. **Configure webhooks.**
   - URL: `${APP_BASE_URL}/api/webhooks/nexconn`
   - Events: message events and translation result events
   - No separate signing secret: webhooks are signed with the application's
     App Secret, so only `NEXCONN_APP_KEY` / `NEXCONN_APP_SECRET` are needed
   - Keep the raw body available for signature verification
5. **Record plan limits.**
   Fill in §4.6 so load tests are realistic.
6. **Add the deployment domain.**
   Use HTTPS. Set `APP_BASE_URL` to the public origin (no trailing slash).
7. **Create separate development and production apps** if the plan allows it.

---

## 6. Where the integration plugs in

| Seam | File | Current state |
|---|---|---|
| Server signed HTTP client | `src/server/nexconn/client.ts` | Built — signing, timeouts, primary/backup host failover, JSON unwrap |
| Request signing | `src/server/nexconn/signing.ts` | Built — `sha1(AppSecret + Nonce + Timestamp)` hex |
| Server chat adapter | `src/server/chat/nexconn.ts` | Built — create channel, issue token, publish event, close channel |
| Chat provider selector | `src/server/chat/index.ts` | Working (`local`/`nexconn`) |
| Browser chat transport | `src/client/chat/nexconn.ts` | Built — wraps `@nexconn/chat` behind `ChatClientTransport`, mounted via `src/client/chat/use-live-room.ts` in the student and host room pages |
| Live-event wire format | `src/lib/chat/events.ts` | Built — structured events encoded into text messages |
| Translation adapter (Nexconn, browser-SDK only) | `src/server/translation/nexconn.ts` | Honest `unavailable` result — waiting on Console confirmation (§4.5) |
| Translation adapter (key-free) | `src/server/translation/mymemory.ts` + `src/lib/translation/mymemory.ts` | Built — public MyMemory API, no key; unit-tested failure paths |
| Translation request API | `src/app/api/translate/route.ts` | Built — auth + rate limit; `502 TRANSLATION_UNAVAILABLE` instead of faking a translation |
| Translation selector | `src/server/translation/index.ts` | Working (`passthrough`/`nexconn`/`libretranslate`/`mymemory`) |
| Webhook receiver | `src/app/api/webhooks/nexconn/route.ts` | Built — verify signature → dedupe by external id → ledger |
| Webhook signature | `src/server/webhooks/signature.ts` | Built — reads `AppKey`/`Nonce`/`Timestamp`/`Signature` |
| Student token/config API | `src/app/api/rooms/[joinCode]/join/route.ts` | Built — returns App Key + user token, never the App Secret |
| Student session restore API | `src/app/api/rooms/[joinCode]/session/route.ts` | Built — refresh keeps the participant (same id, no duplicate row); 401 anonymous / 403 non-participant |
| Shared join/session builder | `src/server/rooms/joined.ts` | Built — one payload for join and restore |
| Host live token API | `src/app/api/rooms/[joinCode]/chat-token/route.ts` | Built — owner-only, issues the host's own channel token |
| Student room UI | `src/app/join/[code]/join-room-client.tsx` | Built — restores the session on load, ask, upvote, live badge, polling, translate control (target-language select + per-question/answer translate) |
| Host room UI | `src/app/host/rooms/[joinCode]/host-room-client.tsx` | Built — moderation, answers, close room, live badge |

The server adapters are protected with `import "server-only"` so they cannot be
accidentally bundled into browser code. Two Node-level helpers
(`src/server/nexconn/signing.ts`, `src/server/webhooks/signature.ts`)
deliberately omit that guard so unit tests can import them; both take the
secret as an argument and never read the environment.

The `local` chat provider and `passthrough` translation remain the default
fallbacks and are kept intact.

### Intended message flow

1. Host creates a room → server creates one Open Channel → stores
   `nexconnChannelId` on `ROOMS`.
2. Student joins → server resolves a pseudonymous participant → issues a
   Nexconn user token → returns App Key, token, and channel ID.
3. Browser connects and joins the Open Channel.
4. Student sends a question through the Nexconn Chat SDK.
5. Nexconn delivers it live; the configured webhook archives it and links it to
   a `QUESTIONS` row.
6. The host client receives translations asynchronously.
7. A vote is written to the database with a unique `(question_id, user_id)`
   constraint; the updated count is published to the channel by the server.
8. The host publishes an answer; students receive translated versions.
9. On refresh/rejoin, history is loaded from the application database, not
   from the channel.

---

## 7. Security requirements before submission

- [ ] App Secret exists only in server environment variables.
- [ ] No secret appears in `NEXT_PUBLIC_*`, client bundles, screenshots, or Git.
- [ ] Every host-only route re-checks room ownership on the server.
- [ ] Guest IDs are stable random values, not phone numbers or emails.
- [ ] Votes enforce room membership, active-room status, and uniqueness.
- [ ] Webhooks verify the signature before parsing/processing.
- [ ] Webhook processing is idempotent by Nexconn external event/message ID.
- [ ] Translation failure keeps the original text visible.
- [ ] Closed rooms reject joins, questions, votes, and answers.
- [ ] Rate limits are applied to join, question, vote, and answer endpoints.
- [ ] Cookies are `HttpOnly`, `Secure` in production, and `SameSite=Lax`.

---

## 8. Production checklist

1. Switch the Prisma datasource to Postgres and create a **new baseline
   migration**. Do not reuse the SQLite migration SQL.
2. Provision a managed Postgres instance; it must not be publicly reachable.
3. Set `DATABASE_URL`, `SESSION_SECRET`, `APP_BASE_URL`, Nexconn variables, and
   `NEXCONN_CHAT_PROVIDER="nexconn"` in the hosting provider's secret store.
4. Use a host that supports long-lived Node processes if the local SSE fallback
   is ever enabled. With real Nexconn delivery, the SSE fallback is dev-only.
5. Run `prisma migrate deploy` during deployment.
6. Serve everything over HTTPS.
7. Configure the Nexconn webhook URL for the production domain.
8. Run the README testing checklist on a real phone and a second browser.
9. Confirm the browser network panel contains no App Secret.
10. Check the current plan limits before a large classroom pilot.

### Known dependency advisory

`npm audit` reports high-severity advisories in `deepmerge-ts`, pulled in by the
**Prisma CLI dev tooling** (not the runtime client). The fix requires Prisma 7,
which is a breaking upgrade. Track it, and upgrade after the demo if time
allows; do not run `npm audit fix --force` without reviewing the Prisma 7
migration.

---

## 9. Commands

```bash
# install
npm install

# local database
npx prisma migrate dev
npx prisma generate

# run
npm run dev

# checks
npm run typecheck
npm run lint
npm run build

# inspect data
npx prisma studio
```

Health check: `http://localhost:3000/api/health` should return
`{ "ok": true, "data": { "status": "ok", "database": "connected", ... } }`.

---

## 10. Acceptance checklist mapped to phases

The nine original phases from `README.md` / `docs/architecture.md`. Status uses
the task-brief vocabulary: `IMPLEMENTED`, `PARTIALLY_IMPLEMENTED`,
`NOT_IMPLEMENTED`, `AUTOMATED_TESTED`, `LIVE_TESTED`, `BLOCKED`,
`NEEDS_VERIFICATION`. A row can be both `IMPLEMENTED` and `AUTOMATED_TESTED`.

| Phase | README / architecture requirement | Status | Evidence |
|---|---|---|---|
| 1 | Host auth, room creation, join code + QR, public room lookup | `IMPLEMENTED` | `src/server/auth/*`, `src/server/rooms/*`, `src/app/api/rooms/route.ts`, `/host` UI |
| 2 | Student identity, room joining, participant persistence, token issuance | `IMPLEMENTED` + `AUTOMATED_TESTED` (join/token unit tests) + `LIVE_TESTED` (probe: token issue; join → count 1; re-join same cookie → count 1) | `src/app/api/rooms/[joinCode]/{join,session}/route.ts`, `src/server/rooms/joined.ts` |
| 3 | Live question delivery through the Open Channel | `IMPLEMENTED` + `LIVE_TESTED` (probe: create/send/destroy; poll returns a new answer with `Cache-Control: no-store`) — browser relay `NEEDS_VERIFICATION` | `src/client/chat/nexconn.ts`, `src/client/chat/use-live-room.ts`, `src/lib/api/client.ts`, `src/app/join/[code]/join-room-client.tsx` |
| 4 | Persist room/question/answer history; restore on refresh | `IMPLEMENTED` + `AUTOMATED_TESTED` (validation, API client) + `LIVE_TESTED` (probe: answer persists and is returned by the student poll; refresh restores the same participant) | Prisma schema, `src/server/questions/service.ts`, `src/app/api/rooms/[joinCode]/session/route.ts`, polling in both room clients |
| 5 | Host sees translation; student sees translated answers | `IMPLEMENTED` + `AUTOMATED_TESTED` (provider selection, success, invalid input, HTTP/timeout/quota failures, schema) + `NEEDS_VERIFICATION` (browser GUI) — Nexconn built-in translation remains `BLOCKED` (Console capability unconfirmed; module is browser-SDK only), so the shipped provider is the key-free `mymemory` one | `src/app/api/translate/route.ts`, `src/server/translation/*`, `src/lib/translation/*`, translate control in `src/app/join/[code]/join-room-client.tsx` |
| 6 | Host approves / hides / rejects | `IMPLEMENTED` | `src/app/api/questions/[questionId]/moderation/route.ts`, host UI |
| 7 | Multiple students vote; duplicate votes rejected | `IMPLEMENTED` + `AUTOMATED_TESTED` (`DUPLICATE_VOTE` path) | `src/app/api/questions/[questionId]/votes/route.ts` |
| 8 | Host answers; closed room blocks joins/submissions | `IMPLEMENTED` | `src/app/api/questions/[questionId]/answers/route.ts`, `src/app/api/rooms/[joinCode]/close/route.ts` |
| 9 | Webhook verification, idempotency, rate limits, tests | `IMPLEMENTED` + `AUTOMATED_TESTED` (signing, webhook signature, rate limit, validation) — webhook delivery `BLOCKED` (needs public URL + Console registration) | `src/app/api/webhooks/nexconn/route.ts`, `src/server/webhooks/signature.ts` |

---

## 11. Current gaps and decisions to revisit

- Host authentication is implemented as email + password with DB-backed
  sessions. Email verification and password reset are not built yet; confirm
  whether they are required for the demo.
- Similar-question grouping, export, analytics, and abuse reporting remain
  intentionally deferred, as the architecture requires.
- SQLite is development-only. A Postgres baseline migration is required before
  deployment.
- The local SSE transport is a development convenience. It must not be
  presented as the production real-time layer.
- The Nexconn server chat adapter was **live-probed** on 2026-11-12 against the
  account's Singapore host (token issue, channel create + `channelId` length,
  message send as `vaaniSystem`, destroy — all `code: 0`; see
  `docs/nexconn-integration-contract.md` §I). The **browser end-to-end smoke
  test is still pending**: it needs Console access, a public HTTPS
  `APP_BASE_URL`, and two browser sessions.
- The browser transport is now mounted in the student and host room pages via
  `src/client/chat/use-live-room.ts`; when the Nexconn credentials/providers are
  absent the pages fall back to polling. A failed connect is retried a bounded
  three times (1 s / 3 s / 7 s backoff) before the badge settles on "Offline".
- Translation has a working key-free path (`TRANSLATION_PROVIDER="mymemory"`).
  Nexconn's **built-in** translation is still disabled by default and its
  language coverage is unverified; the `passthrough` provider remains the
  default and keeps working as an honest fallback.
- **Nothing translation-related has been verified in a browser.** The provider
  reachability probe and the unit tests are real; the GUI step is blocked
  because no browser-automation tool is available in this environment.

---

**Owner:** Team lead — Nexconn credentials, Console configuration, deployment.
**Engineering:** Keep this file updated whenever an adapter, environment
variable, or integration contract changes.

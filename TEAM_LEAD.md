# Vaani Room — Team Lead Handoff & Nexconn Integration Guide

> **Status:** Phase 0 (foundation) complete. This document is the single
> checklist for the team lead to connect the real Nexconn application and take
> the project to production. Update it as each integration is completed.
>
> **Read this with:** [`README.md`](./README.md) and
> [`docs/architecture.md`](./docs/architecture.md).

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
| Local dev chat provider + honest passthrough translation | ✅ Complete |
| Responsive marketing shell (`/`, `/host`, `/join`) | ✅ Complete |
| `GET /api/health` with database check | ✅ Complete |
| Real Nexconn chat/token/webhook/translation wiring | ⏳ Pending — needs the values in §4 |
| Host auth (email/password, DB sessions) | ✅ Complete |
| Room creation, QR code, join-code lookup | ✅ Complete |
| Student identity, live questions, votes, answers | ⏳ Phases 2–8 |
| Test suite and production hardening | ⏳ Phase 9 |

The application is deliberately runnable **without** Nexconn credentials:

- `NEXCONN_CHAT_PROVIDER="local"` uses a signed local token and (in Phase 3)
  an SSE development transport.
- `TRANSLATION_PROVIDER="passthrough"` never fabricates a translation. It
  returns `unavailable` and the UI keeps showing the original text.

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
| `NEXCONN_APP_KEY` | Server now; safe public config later | Browser SDK initialization | No |
| `NEXCONN_APP_SECRET` | **Server only** | Privileged Nexconn API calls | **YES — never expose** |
| `NEXCONN_API_BASE_URL` | Server | Nexconn server API base URL / region | No |
| `NEXCONN_WEBHOOK_SECRET` | Server | Webhook signature verification | **Yes** |
| `NEXCONN_CHAT_PROVIDER` | Server | `local` (dev) or `nexconn` | No |
| `TRANSLATION_PROVIDER` | Server | `passthrough`, `nexconn`, or `libretranslate` | No |
| `LIBRETRANSLATE_URL` | Server | Optional local/demo translation | No |
| `LIBRETRANSLATE_API_KEY` | Server | Optional LibreTranslate auth | **Yes** |

Rules:

- Never create a `NEXT_PUBLIC_*` variable for the App Secret, database URL,
  webhook secret, or session secret.
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

Please provide the following. Put the two secrets directly into the local
`.env` (or the deployment secret manager) — do not send them in a group chat.

### 4.1 Nexconn application

- [ ] `NEXCONN_APP_KEY`
- [ ] `NEXCONN_APP_SECRET` (via secret manager only)
- [ ] `NEXCONN_API_BASE_URL` (exact base URL for the account's region)
- [ ] Nexconn plan name and environment (sandbox/staging/production)

### 4.2 Chat SDK

- [ ] Browser SDK package name and version (npm package or CDN URL)
- [ ] Exact browser initialization snippet
- [ ] Open Channel creation call (endpoint, request body, response shape)
- [ ] Open Channel join/subscribe call
- [ ] Message send call and message ID field
- [ ] Server-side message publish call (needed for vote-count updates)
- [ ] Channel close/delete call
- [ ] Any required channel naming rules or length limits

### 4.3 User access tokens

- [ ] Server endpoint that issues a user access token
- [ ] Required auth headers for that endpoint
- [ ] Token TTL and refresh behavior
- [ ] Required `userId` format (length, allowed characters, uniqueness scope)
- [ ] Example response containing token, expiry, and any session fields

### 4.4 Webhooks

- [ ] Confirmation that webhooks can be configured for the account
- [ ] Public callback URL: `${APP_BASE_URL}/api/webhooks/nexconn`
- [ ] Event types to subscribe to (message received, translation result, etc.)
- [ ] Signature header name and algorithm (e.g. HMAC-SHA256)
- [ ] Raw-body requirements for verification
- [ ] Retry policy and duplicate-delivery behavior
- [ ] One real example payload per event type (redact secrets)

### 4.5 Translation

Built-in translation is **disabled by default** in the current Nexconn docs.
The team lead must confirm it is enabled in the Console.

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
   - Copy the signing secret into `NEXCONN_WEBHOOK_SECRET`
   - Keep the raw body available for signature verification
5. **Record plan limits.**
   Fill in §4.6 so load tests are realistic.
6. **Add the deployment domain.**
   Use HTTPS. Set `APP_BASE_URL` to the public origin (no trailing slash).
7. **Create separate development and production apps** if the plan allows it.

---

## 6. Where the integration plugs in

| Seam | File | Current state | Work required |
|---|---|---|---|
| Server chat adapter | `src/server/chat/nexconn.ts` | Explicit "not configured" stub | Implement create channel, issue token, publish event, close channel |
| Chat provider selector | `src/server/chat/index.ts` | Working (`local`/`nexconn`) | None |
| Browser chat transport | `src/client/chat/nexconn.ts` (Phase 3) | Not created | Wrap the Nexconn browser SDK behind `ChatClientTransport` |
| Translation adapter | `src/server/translation/nexconn.ts` | Honest `unavailable` result | Implement async task/result handling |
| Translation selector | `src/server/translation/index.ts` | Working | None |
| Webhook receiver | `src/app/api/webhooks/nexconn/route.ts` (Phase 4) | Not created | Verify signature, dedupe by external ID, archive events |
| Token/config API | `src/app/api/rooms/[joinCode]/join/route.ts` (Phase 2) | Not created | Return App Key + short-lived user token, never the App Secret |

The server adapters are protected with `import "server-only"` so they cannot be
accidentally bundled into browser code.

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

| README / architecture requirement | Phase |
|---|---|
| Host creates a room and displays a working QR code | 1 |
| Student joins from a phone browser without an app | 1–2 |
| Backend issues Nexconn token; App Secret stays server-side | 2 |
| Live question delivery through the Open Channel | 3 |
| Persist room/question/answer history; restore on refresh | 4 |
| Host sees translation; student sees translated answers | 5 |
| Host approves / hides / rejects | 6 |
| Multiple students vote; duplicate votes rejected | 7 |
| Host answers; answers translated per student | 8 |
| Closing a room blocks joins and submissions | 8 |
| Webhook verification, idempotency, rate limits, tests | 9 |

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
- Translation quality and language coverage are unverified until the team lead
  enables Nexconn translation and supplies the language mapping.

---

**Owner:** Team lead — Nexconn credentials, Console configuration, deployment.
**Engineering:** Keep this file updated whenever an adapter, environment
variable, or integration contract changes.

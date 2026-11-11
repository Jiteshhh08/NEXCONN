# Implementation Notes

This document records how the implemented system actually works. It is the
engineering companion to [`README.md`](../README.md) (product requirements) and
[`docs/architecture.md`](./architecture.md) (design authority).

> **Phase 0 status:** foundation only. Feature routes listed as "planned" below
> are not implemented yet.

---

## 1. Stack decisions

| Area | Choice | Version | Notes |
|---|---|---|---|
| Framework | Next.js App Router | 16.4.6 | Turbopack dev/build |
| UI | React | 19.3.1 | Server Components by default |
| Language | TypeScript | 5.9.3 | `strict`, `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS | 4.3.5 | CSS-first `@theme` tokens, no `tailwind.config` |
| ORM | Prisma | 6.19.3 | SQLite locally; Postgres for production |
| Validation | Zod | 4.6.7 | Shared request schemas |
| Icons | lucide-react | 1.72.0 | |
| QR (planned) | qrcode | 1.5.4 | Server-side generation in Phase 1 |

### Why Next.js 16 rather than 15

Next.js 15 bundles a PostCSS version affected by published advisories. Since
security is an explicit project requirement, the app was upgraded to the current
stable Next 16. That brought two consequences:

- **Zod 4 instead of Zod 3.** `required_error` is gone; use `.min()` messages, and
  `error.issues` replaces `flatten()` in the API layer.
- **Next 16 conventions.** Async `cookies()`, async route `params`,
  `proxy.ts` instead of `middleware.ts`, and flat ESLint config built from
  `eslint-config-next/core-web-vitals` + `/typescript`.

### Why Prisma 6 rather than 7

Prisma 7 is a breaking major. Staying on 6.19.3 keeps the documented model
working today. `npm audit` reports advisories in `deepmerge-ts`, which is pulled
in by Prisma's **CLI dev tooling**, not the runtime client. Tracked in
`TEAM_LEAD.md` §8.

### Why SQLite locally

There is no Docker/Postgres daemon on the development machine. The schema is
written to be portable: no SQLite-only types, string enums stored as `String`
plus TypeScript union types, and explicit composite indexes. A Postgres baseline
migration is required before deployment.

---

## 2. Directory map

```text
src/
├── app/
│   ├── layout.tsx              Root layout, metadata, skip link, chrome
│   ├── page.tsx                Landing page
│   ├── host/
│   │   ├── page.tsx            Protected dashboard + room list
│   │   ├── login/page.tsx      Host sign in
│   │   ├── register/page.tsx   Host sign up
│   │   └── rooms/[joinCode]/   Room QR + share view
│   ├── join/
│   │   ├── page.tsx            Code entry
│   │   └── [code]/page.tsx     Public room confirmation
│   ├── error.tsx               Route error boundary
│   ├── not-found.tsx           404
│   ├── manifest.ts             PWA manifest
│   ├── icon.svg                App icon
│   ├── globals.css             Tailwind theme tokens, base, utilities
│   └── api/
│       ├── auth/{register,login,logout,me}/route.ts
│       ├── rooms/route.ts      Create + list host rooms
│       └── health/route.ts     GET health + DB connectivity
├── components/
│   ├── auth/host-auth-form.tsx
│   ├── host/                   Create room, copy link, sign out
│   ├── join/join-code-form.tsx
│   ├── brand/logo.tsx
│   ├── marketing/hero-preview.tsx
│   ├── site-header.tsx
│   ├── site-footer.tsx
│   └── ui/                     button, card, input, badge, alert
├── lib/
│   ├── api/errors.ts           AppError taxonomy and helpers
│   ├── api/request.ts          Origin check
│   ├── api/response.ts         Success/error envelope + parseJson
│   ├── chat/contracts.ts       Chat provider/client interfaces
│   ├── translation/contracts.ts Translation provider interfaces
│   ├── domain.ts               Roles, statuses, 12 languages
│   ├── env.ts                  Zod env validation + runtime guards
│   ├── validation.ts           Request schemas
│   ├── format.ts               Date formatting
│   ├── db.ts                   Prisma singleton
│   └── utils.ts                cn()
├── instrumentation.ts          Runtime startup checks (secrets)
└── server/
    ├── auth/
    │   ├── password.ts         scrypt hash + verify
    │   ├── session.ts          Cookie, session lookup, requireHost
    │   └── rate-limit.ts       In-process fixed window
    ├── rooms/
    │   ├── service.ts          Create/list/lookup + channel provisioning
    │   ├── join-code.ts        Unambiguous 7-character codes
    │   └── share.ts            Join URL + QR data URL
    ├── chat/
    │   ├── index.ts            Provider selector
    │   ├── local.ts            Signed local dev tokens
    │   └── nexconn.ts          Integration stub
    └── translation/
        ├── index.ts            Provider selector
        ├── passthrough.ts      Honest fallback
        ├── nexconn.ts          Integration stub
        └── libretranslate.ts   Optional local provider
```

---

## 3. Conventions

### API envelope

Every JSON endpoint returns one of:

```json
{ "ok": true, "data": { } }
```

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted fields.",
    "details": { "fieldErrors": [{ "field": "title", "message": "…" }] }
  }
}
```

- `src/lib/api/response.ts` owns `apiSuccess`, `apiFailure`, `apiError`,
  `parseJson`.
- `apiError` maps `AppError` → its status, `ZodError` → 422 with field errors,
  Prisma `P2002` → 409, `P2025` → 404, everything else → 500 with a generic
  message. Unknown errors are logged, never leaked.
- Validation details use `error.issues`, not the Zod 3 `flatten()` shape.

### Error codes

`INVALID_JSON`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `ROOM_CLOSED`, `DUPLICATE_VOTE`, `RATE_LIMITED`,
`TRANSLATION_UNAVAILABLE`, `INTEGRATION_NOT_CONFIGURED`, `INTERNAL_ERROR`.

### Domain values

- Roles: `host`, `student`.
- Room status: `active`, `closed`.
- Moderation: `pending`, `approved`, `hidden`, `rejected` (host actions exclude
  `pending`).
- Translation: `pending`, `ready`, `failed`, `unavailable`.
- Languages (12): `en hi mr gu ta te bn kn ml pa or ur`; Urdu is marked RTL.
- Persisted as strings + TypeScript unions so the schema stays Postgres-portable.

### Secrets

- `src/lib/env.ts` imports `server-only`.
- Production requires `SESSION_SECRET` ≥ 32 chars.
- `NEXCONN_CHAT_PROVIDER=nexconn` requires App Key + Secret or startup fails.
- Nothing privileged uses a `NEXT_PUBLIC_*` variable.

---

## 4. Real-time and translation seams

```text
Question flow
browser ──ChatClientTransport──▶ Nexconn Open Channel ──▶ other browsers
   │                                   │
   │                                   └── webhook ──▶ app DB (Phase 4)
   └── REST ──▶ Vaani Room API ──▶ Prisma
```

- `ServerChatProvider` (`src/lib/chat/contracts.ts`): `createChannel`,
  `issueUserToken`, `publishEvent`, `closeChannel`.
- `ChatClientTransport`: `connect`, `joinChannel`, `sendQuestion`, `onEvent`,
  `disconnect`. Phase 3 adds the local SSE implementation and the Nexconn SDK
  implementation.
- `TranslationProvider`: one async `translate()` returning
  `{ translatedText, status, provider, errorMessage }`.
- The **passthrough** provider never invents text: same language → `ready`, any
  other pair → `unavailable` with a reason. The UI must keep the original
  visible.
- The **local** chat provider signs a short-lived HMAC token with
  `SESSION_SECRET`; it is a development transport only and must be labelled as
  such in the UI.

Provider selection is centralized in `src/server/chat/index.ts` and
`src/server/translation/index.ts`. Domain code depends on the interface, never
on a concrete provider.

---

## 5. Authentication and rooms

### Host authentication

- Email + password, chosen because it has no external dependency and is enough
  for a demo. Students never register.
- Passwords use Node `scrypt` with a 16-byte random salt and a 64-byte derived
  key. Stored as `scrypt$<salt>$<hash>`.
- Sessions are database-backed: a 32-byte random token is sent in an
  `HttpOnly`, `SameSite=Lax`, `Secure`-in-production cookie, and only its
  SHA-256 hash is stored in `SESSION`.
- Session lifetime is 7 days. Expired rows are deleted on lookup.
- Registration and login are rate-limited per client key (5 per 15 minutes and
  10 per 15 minutes respectively). The limiter is in-process, sweeps expired
  buckets, and caps storage at 10,000 keys so a flood of distinct keys cannot
  grow memory without bound. It should still be replaced with a shared store
  for multi-instance deployments.
- Client IPs are only read from `TRUSTED_PROXY_HEADER` when that variable names
  a header the deployment proxy overwrites. `TRUSTED_PROXY_HOPS` selects the
  right entry from a forwarding chain. With the default `none`, forwarding
  headers are ignored and requests share one conservative bucket.
- State-changing API routes check `Origin` when the browser sends it.

Routes: `POST /api/auth/register`, `POST /api/auth/login`,
`POST /api/auth/logout`, `GET /api/auth/me`.

### Rooms

- Join codes are 7 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no
  ambiguous `I`, `L`, `O`, `0`, `1`). Collisions retry up to eight times
  against the unique database constraint.
- Creating a room also provisions its chat channel through the configured
  `ServerChatProvider`. If channel creation fails, the room row is removed so
  the database never holds a room without a channel.
- The QR data URL is generated server-side with `qrcode` from
  `APP_BASE_URL + /join/<code>`, so the printed code always points at the
  configured deployment.
- The host dashboard and room detail page are server components that call
  `getSessionUser()` and redirect unauthenticated visitors to
  `/host/login`. Room detail also checks ownership; another host's room returns
  404.
- `/join/[code]` is public and only exposes the room title, host display name,
  host language, status, dates, and participant count. It never exposes host
  email or channel credentials.

Routes: `GET/POST /api/rooms`.

### Deliberate Phase 1 boundary

`/join/[code]` confirms the room exists and is open, but the name/language
identity step and live question board arrive in Phase 2–3. The page says so
instead of pretending the join is complete.

---

## 6. Data model notes

Mirrors `docs/architecture.md` §7 with these deliberate details:

- `Vote` has `@@unique([questionId, userId])` — the database-level duplicate-vote
  guarantee.
- `Room.joinCode` and `Room.nexconnChannelId` are unique.
- `Question` has `@@unique([roomId, clientNonce])` for idempotent retries, plus
  `nexconnMessageId` unique when a message is linked.
- `Answer.nexconnMessageId` is unique.
- `MessageTranslation` caches async results by `(messageId, targetLanguage)`.
- `WebhookEvent.externalId` is unique for idempotent webhook processing.
- `Participant` has `@@unique([roomId, userId])`.
- All cascade deletes are explicit; optional FKs use `SetNull`.

SQLite does not enforce enum types, so application code validates every status
transition with Zod and the role/status unions.

---

## 7. Phase log

| Phase | Scope | State |
|---|---|---|
| 0 | Scaffold, schema, migration, env, contracts, UI shell, health | ✅ Done |
| 1 | Host auth, room creation, QR, public room page | ✅ Done |
| 2 | Identity, join flow, Nexconn token issuance | ⏳ Next |
| 3 | Live channel transport, question submission/feed | ⏳ |
| 4 | Persistence, history, webhooks | ⏳ |
| 5 | Translation pipeline for questions/answers | ⏳ |
| 6 | Moderation controls | ⏳ |
| 7 | Votes and deduplication | ⏳ |
| 8 | Answers, room closure, polish | ⏳ |
| 9 | Hardening, tests, docs, production migration | ⏳ |

---

## 8. Verification

Commands (Windows PowerShell; use `npm.cmd`/`npx.cmd` if the execution policy
blocks the shims):

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Expected Phase 1 result: all three pass. `GET /api/health` returns
`{ "ok": true, "data": { "status": "ok", "database": "connected", … } }`.

End-to-end smoke test performed against the dev server:

1. `GET /host` without a session renders the sign-in page.
2. `POST /api/auth/register` returns 201, sets an HttpOnly cookie, and
   `GET /api/auth/me` returns the host.
3. `POST /api/rooms` returns 201 with a join code, a `local_*` channel ID, and
   a `data:image/png` QR data URL.
4. `GET /join/<code>` returns 200 and contains the room title.
5. `GET /host/rooms/<code>` returns 200 for the owner.
6. `POST /api/auth/logout` clears the session; `/host` shows sign-in again.
7. Unauthenticated `POST /api/rooms` returns 401, duplicate registration returns
   409, and a wrong password returns 401.

Manual layout checks: `/`, `/host/login`, `/host/register`, `/host`,
`/host/rooms/<code>`, `/join`, `/join/<code>` at 360 px and 1440 px widths.

Hardening checks (Phase 1 review fixes):

- A production build with `NODE_ENV=production` and no `SESSION_SECRET` completes
  route collection and static generation successfully.
- `next start` without `SESSION_SECRET`, or with one shorter than 32
  characters, exits with code 1 and a clear message before serving traffic.
  With a valid secret it starts and `GET /api/health` returns 200.
- With the default `TRUSTED_PROXY_HEADER="none"`, six registration attempts
  carrying six different spoofed `X-Forwarded-For` values returned
  `201,201,201,201,201,429`: the header is ignored and all requests share one
  bucket.
- With `TRUSTED_PROXY_HEADER="x-forwarded-for"` and `TRUSTED_PROXY_HOPS="1"`,
  five attempts from one IP were allowed, the sixth from that IP returned 429,
  and an attempt from a different IP returned 201.

---

## 9. Known issues and follow-ups

1. Prisma CLI advisory (`deepmerge-ts`) — needs Prisma 7; deferred.
2. `.env` exists locally with a dev secret; it is gitignored. Production must
   use the host's secret manager.
3. `AGENTS.md` is regenerated by `next dev`; keep the Next 16 rules block in
   commits.
4. ESLint can appear to hang on a cold run while it resolves the flat config;
   the second run is fast.
5. No automated tests yet — Phase 9 adds them.
6. The rate limiter is in-process. Replace it with a shared store before running
   more than one server instance.
7. There is no email verification or password-reset flow yet; registration is
   open and should be restricted or verified before a public launch.
8. `/join/<code>` deliberately stops before the name/language step. Phase 2
   adds participant identity and Nexconn token issuance.
9. Room closure exists in the schema and UI states, but the host close action is
   not wired yet (Phase 8).

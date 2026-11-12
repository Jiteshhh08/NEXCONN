# Vaani Room — Nexconn Integration Contract

> **Purpose:** the single durable record of every Nexconn contract Vaani Room
> depends on, the official source that proves it, and where it lives in this
> repository.
>
> **Rule for this document:** nothing is listed as a contract unless it is
> backed by an official Nexconn source. Anything that could not be verified from
> official documentation is marked `UNVERIFIED` or
> `NEEDS-CONSOLE-CONFIRMATION` and must not be treated as working behaviour.
>
> **Primary reference:** <https://docs.nexconn.ai/guides?fr=console>
> **Console:** <https://console.nexconn.ai/agile/dashboard/workplace>

## Status legend

| Status | Meaning |
|---|---|
| `VERIFIED` | Confirmed against official Nexconn documentation *and* the installed SDK type declarations. |
| `IMPLEMENTED` | The verified contract is wired into this repository and passes typecheck, lint, tests and build. |
| `LIVE-TESTED` | Exercised against a real Nexconn application/Console. Rows marked `LIVE-TESTED (probe)` were confirmed on 2026-11-12 with a signed server-to-server probe against the account's Singapore host; rows marked `LIVE-TESTED (smoke)` additionally require the browser UI (see §I). |
| `NEEDS-CONSOLE-CONFIRMATION` | Depends on a Console/account setting or plan that only the team lead can read. |
| `BLOCKED` | Cannot be completed with the information and access available today. |
| `UNVERIFIED` | Not confirmed by an official source; do not rely on it. |

**Important:** `IMPLEMENTED` means *written against a verified contract*, not
*proven to work against Nexconn*. Only `LIVE-TESTED` means the integration was
observed working end to end. The 2026-11-12 probe reached `LIVE-TESTED (probe)`
for the four server endpoints and the `channelId`/sender rules in §I; every
other row is still `IMPLEMENTED` or `NEEDS-CONSOLE-CONFIRMATION`. No row is
`LIVE-TESTED (smoke)` yet: the browser UI has not been driven end to end against
a live account.

---

## A. App credentials and environment

| Requirement | Verified contract | Official source | Current code location | Status / blocker |
|---|---|---|---|---|
| App Key | Console-issued app identifier; sent as the `App-Key` header on Chat Server API requests and as the `AppKey` header on webhooks. Safe to place in browser code. | [API request signature](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth), [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview) | `NEXCONN_APP_KEY` in `src/lib/env.ts`; read in `src/server/nexconn/client.ts` | `IMPLEMENTED` |
| App Secret | Console-issued secret used only to compute request/webhook signatures. **Server-only.** | [API request signature](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth) | `NEXCONN_APP_SECRET` in `src/lib/env.ts`; read in `src/server/nexconn/client.ts` | `IMPLEMENTED` |
| Region base URL | `https://api.sg-light-api.com` (Singapore, + backup `api-b.sg-light-api.com`), `https://api.us-light-api.com` (North America, + backup `api-b.us-light-api.com`), `https://api.sau-light-api.com` (Saudi Arabia, + backup `api-b.sau-light-api.com`). Use the backup host on a 5-second timeout or an unexpected status. | [Base URL](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/base-url) | `NEXCONN_API_BASE_URL` in `src/lib/env.ts`; consumed by `resolveBaseUrl()` in `src/server/nexconn/client.ts` | `LIVE-TESTED (probe)` for this account — the configured host returned `code: 0` on token issue, channel create, message send and destroy. The production value must still be set to the account's own region; the code throws on a missing value rather than guessing. |
| Asia/Beijing base URL | The documentation set reviewed does not publish a Beijing base host. | [Base URL](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/base-url) | — | `UNVERIFIED` |
| Request signing | `Signature = sha1(AppSecret + Nonce + Timestamp)`, lowercase hex. `Timestamp` is Unix **milliseconds**; `Nonce` is a random string of at most 18 characters. | [API request signature](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth) | `signRequest()` / `createNonce()` in `src/server/nexconn/signing.ts` | `IMPLEMENTED` |
| Signed request headers | `App-Key`, `Nonce`, `Timestamp`, `Signature`, and `Content-Type: application/json`. `X-Request-ID` is optional (≤36 chars). | [API request signature](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth) | `nexconnRequest()` in `src/server/nexconn/client.ts` | `IMPLEMENTED` |
| All endpoints are `POST` | Every Platform Chat API endpoint uses the HTTP `POST` method with a JSON body. | [Endpoint list](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/chat-server-api-list) | `nexconnRequest()` in `src/server/nexconn/client.ts` | `IMPLEMENTED` |
| Timestamp validity window | The docs describe the concatenation but do not publish an accepted clock-skew window. This integration sends the current time and does not enforce a window on inbound webhooks. | [API request signature](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth) | `src/server/webhooks/signature.ts` (no window enforced) | `UNVERIFIED` |
| Startup validation | Server refuses to start with `NEXCONN_CHAT_PROVIDER=nexconn` when the App Key or App Secret is missing. | Internal rule (not a Nexconn contract) | `assertRuntimeEnv()` in `src/lib/env.ts`, invoked from `src/instrumentation.ts` | `IMPLEMENTED` |
| Secret hygiene | The App Secret must never reach the browser, a `NEXT_PUBLIC_*` variable, a log, or Git. The modules that read it import `server-only`. `signing.ts` is deliberately guard-free so focused tests can import it; it never reads the environment and the secret is passed in as an argument. | Internal rule | `import "server-only"` in `src/server/nexconn/client.ts` and `src/server/chat/nexconn.ts` | `IMPLEMENTED` |
| Separate dev/production apps | The docs do not define environment separation; the team should use two applications if the plan allows. | — | `.env.example` | `NEEDS-CONSOLE-CONFIRMATION` |

---

## B. Browser SDK contract

Installed packages (verified in `node_modules`, do not reinstall or change):

| Package | Version | Notes |
|---|---|---|
| `@nexconn/chat` | `26.2.1` | Browser Chat SDK; declares `peerDependencies: { "@nexconn/engine": "=26.2.1" }` |
| `@nexconn/engine` | `26.2.1` | Supplies primitives such as `RCResult` |

| Requirement | Verified contract | Official source | Current code location | Status / blocker |
|---|---|---|---|---|
| Import and initialization | `import { NCEngine } from "@nexconn/chat"`, then `NCEngine.initialize({ appKey, logLevel?, areaCode?, naviServer? })`. Must be called exactly once, before any other SDK call. | [Web SDK init](https://docs.nexconn.ai/chatsdk-web/init), `node_modules/@nexconn/chat/index.d.ts:2891-2910` | `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Default area/log level | `AreaCode.SG` is the default region and `LogLevel.WARN` the default log level. | [Web SDK init](https://docs.nexconn.ai/chatsdk-web/init) | `src/client/chat/nexconn.ts` (initializes with `LogLevel.WARN`) | `IMPLEMENTED` |
| Connect | `NCEngine.connect({ token })` resolves to `RCResult<ConnectResult>`; check `isOk` before treating the connection as live. | `index.d.ts:2911-2925` | `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Disconnect | `NCEngine.disconnect(disablePush?)`. | `index.d.ts:2947-2958` | `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Join an open channel | `new OpenChannel(channelId).enterChannel({ messageCount })`. Join/leave for open channels is **Client SDK only** — there is no server API for joining. | [Open channel overview](https://docs.nexconn.ai/platform-chat-api/open-channel/overview) (`docs.nexconn.ai/chatsdk-web/open-channels/joining-channel` currently returns **Page Not Found**), `index.d.ts:4157-4208` | `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Leave an open channel | `channel.exitChannel(extra?)`. Local open-channel history is cleared by the SDK when the user exits. | [Open channel overview](https://docs.nexconn.ai/platform-chat-api/open-channel/overview) | `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Receive messages | `NCEngine.addMessageHandler(id, new MessageHandler({ onMessageReceived({ messages }) }))`; `Message` exposes `messageId`, `messageType`, `senderUserId`, `sentTime`, `metadata: Map<string,string>`. | `index.d.ts:1775-1817`, `index.d.ts:3033` | `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Send a text message | `new SendTextMessageParams({ text })` then `channel.sendMessage(params)`. Client content field is `text` (the engine maps it to `content` internally). Optional `metadata?: Record<string,string>`. | `index.d.ts:966-1010`, `index.d.ts:3672` | `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Transport seam | The SDK must stay behind `ChatClientTransport` so the `local` development transport can remain the default. | Internal contract | `src/lib/chat/contracts.ts`, `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Open channel `channelId` format | The create/info/overview pages state the field exists but publish no character set, length, or prefix rule. Live probe: a 64-character id was accepted; the same id at 65 characters was rejected with HTTP 400 / `code 1002`. Mixed case, `-` and `_` are accepted. | [Create an open channel](https://docs.nexconn.ai/platform-chat-api/open-channel/create) | `channelIdForRoom()` in `src/server/chat/nexconn.ts` uses the Vaani room id (lowercase alphanumeric cuid) | `LIVE-TESTED (probe)` — **maximum length 64 characters**; the room-id scheme is inside that bound |
| `naviServer` override | `InitParams.naviServer` exists but the docs do not describe when to set it. Not used. | `index.d.ts` | — | `UNVERIFIED` |

---

## C. Open Channel server operations

| Requirement | Verified contract | Official source | Current code location | Status / blocker |
|---|---|---|---|---|
| Create an open channel | `POST {BaseURL}/v4/open-channel/create` — body `{ channelId, destroyType?, ttlMinutes?, shouldFreeze?, allowedSendersList?, metadataOwnerId?, metadata? }` → `{ code: 0 }`. Rate limit 100/sec. Optional fields are omitted so the documented defaults apply (`destroyType: 0` = destroy after 60 minutes of inactivity). | [Create an open channel](https://docs.nexconn.ai/platform-chat-api/open-channel/create) | `NexconnChatProvider.createChannel()` in `src/server/chat/nexconn.ts` | `IMPLEMENTED` (default retention is `NEEDS-CONSOLE-CONFIRMATION` for classroom length) |
| Auto-destroy defaults | `destroyType 0` destroys the channel after 60 minutes with no joins/leaves/messages; `ttlMinutes` range is 60–10,080 (7 days). | [Create an open channel](https://docs.nexconn.ai/platform-chat-api/open-channel/create) | `createChannel()` in `src/server/chat/nexconn.ts` (defaults left as-is) | `IMPLEMENTED` |
| Destroy an open channel | `POST {BaseURL}/v4/open-channel/destroy` — body `{ channelIds: string[] }` → `{ code: 0 }`. Rate limit 100/sec. | [Destroy an open channel](https://docs.nexconn.ai/platform-chat-api/open-channel/destroy) | `NexconnChatProvider.closeChannel()` in `src/server/chat/nexconn.ts` | `IMPLEMENTED` |
| Send a server message to a channel | `POST {BaseURL}/v4/open-channel/message/send` — body `{ fromUserId, toChannelIds: string[], messageType, content, shouldPersist?, isEchoToSender?, priority? }` → `{ code: 0, result: { messageIds: [{ channelId, messageId }] } }`. Rate limit 100/sec and **counted per target channel**. | [Send an open channel message](https://docs.nexconn.ai/platform-chat-api/message/open-channel/send-open-channel) | `NexconnChatProvider.publishEvent()` in `src/server/chat/nexconn.ts` | `IMPLEMENTED` |
| Text message payload shape (server) | `messageType` is `RC:TxtMsg`; `content` is the built-in content object **serialized as a string**, with the text in the `content` key: `"{\"content\":\"hello\"}"`. Server bodies have no metadata field, so structured events travel inside the text body. | [User content message format](https://docs.nexconn.ai/platform-chat-api/message/message-about/objectname), [Send an open channel message](https://docs.nexconn.ai/platform-chat-api/message/open-channel/send-open-channel) | `encodeLiveEvent()` in `src/lib/chat/events.ts`, applied in `publishEvent()` | `IMPLEMENTED` |
| Sender need not be a member | The App Server can send to a group or open channel without the sending user being a member. | [Endpoint list](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/chat-server-api-list) | `publishEvent()` in `src/server/chat/nexconn.ts` | `IMPLEMENTED` |
| Server message sender id | `fromUserId` is required, but the docs do not state whether the sender must be a registered user. `publishEvent()` sends room events as the reserved id `vaaniSystem`. Live probe: sending from `vaaniSystem` returned HTTP 200 / `code 0` with one `messageId`, so an unregistered sender id is accepted. | [Send an open channel message](https://docs.nexconn.ai/platform-chat-api/message/open-channel/send-open-channel) | `SYSTEM_SENDER_USER_ID` in `src/server/chat/nexconn.ts` | `LIVE-TESTED (probe)` — the server can publish as `vaaniSystem` without registering that user |
| Message size limit | Message `content` must not exceed 10 KB for text messages. | [Send an open channel message](https://docs.nexconn.ai/platform-chat-api/message/open-channel/send-open-channel) | `publishEvent()` in `src/server/chat/nexconn.ts` (payloads are small room events) | `IMPLEMENTED` |
| Server-API messages are excluded from webhooks/moderation by default | Messages sent via the server API are **not** included in post-event webhook delivery and are **not** filtered by profanity/pre-messaging webhooks unless the Console toggles are enabled. | [Endpoint list](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/chat-server-api-list) | — | `NEEDS-CONSOLE-CONFIRMATION` |
| Open channel cloud retention | `shouldPersist: 1` requires the **Open Channel cloud retention** service, which is off by default. Vaani Room therefore keeps its own history in the application database. | [Send an open channel message](https://docs.nexconn.ai/platform-chat-api/message/open-channel/send-open-channel) | `prisma/schema.prisma` (`Question`, `Answer`), `docs/architecture.md` §10 | `NEEDS-CONSOLE-CONFIRMATION` |

---

## D. User access token contract

| Requirement | Verified contract | Official source | Current code location | Status / blocker |
|---|---|---|---|---|
| Issue an access token | `POST {BaseURL}/v4/auth/access-token/issue` — body `{ userId, name, avatarUrl? }` → `{ code: 0, result: { userId, accessToken } }`. Rate limit 200/sec. Live probe: HTTP 200, `code 0`, `result.userId` present and `result.accessToken` returned. | [Register a user](https://docs.nexconn.ai/platform-chat-api/user/register) | `NexconnChatProvider.issueUserToken()` in `src/server/chat/nexconn.ts` | `LIVE-TESTED (probe)` |
| `userId` format | App-defined; uppercase and lowercase letters and numbers only, maximum 64 bytes. Obtaining a token registers the user. | [Register a user](https://docs.nexconn.ai/platform-chat-api/user/register) | Vaani `User.id` (cuid, lowercase alphanumeric) passed straight through | `IMPLEMENTED` |
| `name` | Required. Used only for push notifications; maximum 64 characters. Re-issuing with new values overwrites it. | [Register a user](https://docs.nexconn.ai/platform-chat-api/user/register) | `NexconnChatProvider.issueUserToken()` in `src/server/chat/nexconn.ts` (display name, truncated to 64) | `IMPLEMENTED` |
| Token TTL | Tokens are **valid indefinitely by default**; the Console can set an expiry. Refreshing the App Secret invalidates every token under the App Key. | [Register a user](https://docs.nexconn.ai/platform-chat-api/user/register), [Expire an access token](https://docs.nexconn.ai/platform-chat-api/user/expire) | `ChatUserToken.expiresAt` is filled with a Vaani-side refresh hint, not a Nexconn-guaranteed expiry | `NEEDS-CONSOLE-CONFIRMATION` — the account's token expiry setting |
| Token delivery | The app server issues the token and hands it to the client; the client SDK never fetches tokens itself. | [Register a user](https://docs.nexconn.ai/platform-chat-api/user/register) | `src/app/api/rooms/[joinCode]/join/route.ts` | `IMPLEMENTED` |
| Token is never the App Secret | The browser receives App Key + user token only. | [Register a user](https://docs.nexconn.ai/platform-chat-api/user/register) | `src/app/api/rooms/[joinCode]/join/route.ts` response body | `IMPLEMENTED` |
| Re-issue for an existing user | The same `userId` can obtain tokens repeatedly and all valid tokens connect. | [Register a user](https://docs.nexconn.ai/platform-chat-api/user/register) | `src/app/api/rooms/[joinCode]/join/route.ts` (reuses the existing participant user) | `IMPLEMENTED` |

---

## E. Webhook contract

| Requirement | Verified contract | Official source | Current code location | Status / blocker |
|---|---|---|---|---|
| Receiver URL | A single HTTPS/HTTP URL registered in Console → Chat → Chat settings → Webhooks. Vaani Room uses `${APP_BASE_URL}/api/webhooks/nexconn`. | [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview) | `src/app/api/webhooks/nexconn/route.ts` | `NEEDS-CONSOLE-CONFIRMATION` — the URL must be registered for the account |
| Signature headers | `AppKey`, `Nonce` (≤18 chars), `Timestamp` (Unix ms), `Signature`. | [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview) | `src/server/webhooks/signature.ts` | `IMPLEMENTED` |
| Signature formula | `Signature = sha1(AppSecret + Nonce + Timestamp)`, lowercase hex. There is **no separate webhook secret** — the App Secret signs webhooks. | [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview) | `verifyWebhookSignature()` in `src/server/webhooks/signature.ts` | `IMPLEMENTED` |
| Event envelope | `{ type: string, id: string (UUID or Snowflake), time: number (Unix ms), data: unknown[] }`. Empty/null fields are omitted. | [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview) | `webhookEnvelopeSchema` in `src/app/api/webhooks/nexconn/route.ts` | `IMPLEMENTED` |
| Delivery behaviour | `POST`, `Content-Type: application/json`, 5-second timeout, 2 retries (3 attempts total), 2xx means success. Circuit breaker: 30 fully-failed events in one minute pauses delivery for one minute. | [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview) | `src/app/api/webhooks/nexconn/route.ts` (returns 2xx on accepted events) | `IMPLEMENTED` |
| Idempotency | Deliveries can repeat, so events must be de-duplicated. Vaani Room stores the envelope `id` in `WebhookEvent.externalId` (unique). | [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview) | `WebhookEvent` in `prisma/schema.prisma`; duplicate handling in `src/app/api/webhooks/nexconn/route.ts` | `IMPLEMENTED` |
| Event types relevant to Vaani Room | `open_channel:operation` (join/leave/create/destroy), `message:send`, `open_channel:pre_messaging`, `message_moderation:block`, `message_moderation:suspected`. | [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview) | Archived as raw payloads in `WebhookEvent` | `IMPLEMENTED` (archive only — no domain handler yet) |
| Pre-messaging event availability | `*:pre_messaging` events are available on the Chat Free and Pro plans, **not** on Starter. | [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview), [Pre-messaging](https://docs.nexconn.ai/platform-chat-api/webhook/message/pre-messaging) | — | `NEEDS-CONSOLE-CONFIRMATION` |
| Inbound IP allowlist | Singapore: 13 addresses; North America: `52.41.206.152`; Saudi Arabia: 6 addresses. | [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview) | — | `NEEDS-CONSOLE-CONFIRMATION` — relevant only when inbound filtering is enabled |
| `channelType` values | `1` direct, `3` group, `4` open, `6` system, `10` community. | [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview) | — | `VERIFIED` |
| Translation result webhook | No translation-result webhook event type is documented. Translation results reach the **client** through `TranslateHandler`. | [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview), [Translation events and results](https://docs.nexconn.ai/chatsdk-web/builtin-translation/translation-events-and-results) | — | `BLOCKED` — a server-side translation-result webhook cannot be built |
| Per-event payload shapes | Individual payload fields per event type were not transcribed here. The receiver archives the raw envelope. | [Webhook overview](https://docs.nexconn.ai/platform-chat-api/webhook/overview) | `src/app/api/webhooks/nexconn/route.ts` | `UNVERIFIED` — confirm each payload before adding a domain handler |

---

## F. Translation contract

| Requirement | Verified contract | Official source | Current code location | Status / blocker |
|---|---|---|---|---|
| Where translation runs | Nexconn built-in translation is a **client SDK** feature (`NCEngine.translateModule` + `TranslateHandler`). There is no server translation endpoint. | [Built-in translation](https://docs.nexconn.ai/chatsdk-web/builtin-translation/overview), [Translation tasks](https://docs.nexconn.ai/chatsdk-web/builtin-translation/translation-tasks) | `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Enablement | Disabled by default; must be enabled in Console → Chat → Chat settings → Messages → Translation. | [Built-in translation](https://docs.nexconn.ai/chatsdk-web/builtin-translation/overview) | — | `NEEDS-CONSOLE-CONFIRMATION` |
| Request a translation | `NCEngine.translateModule.translateMessages({ list, force?, mode? })` with a maximum of 10 items per call. | [Translation tasks](https://docs.nexconn.ai/chatsdk-web/builtin-translation/translation-tasks) | `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Web requires `text` | On Web each `TranslateMessageParam(messageId, sourceLanguage?, targetLanguage?, text)` must include `text`, otherwise the request fails with `TRANSLATION_PARAMS_TYPE_INVALID` (35060). | [Translation tasks](https://docs.nexconn.ai/chatsdk-web/builtin-translation/translation-tasks) | `src/client/chat/nexconn.ts` (passes the original message text) | `IMPLEMENTED` |
| Result delivery | Asynchronous. Results arrive via `TranslateHandler.onTranslationCompleted({ results })`; `TranslateResult` carries `identifier`, `sourceType` (`MESSAGE: 0`, `CUSTOM_TEXT: 1`), `code` (`0` = success) and `translateInfo { targetLanguage, translatedText, status }`. | [Translation events and results](https://docs.nexconn.ai/chatsdk-web/builtin-translation/translation-events-and-results), `index.d.ts:1823-1884` | `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Target language | `setTranslationLanguage(language)` / `getTranslationLanguage()`; `setAutoTranslateEnabled(boolean)` / `getAutoTranslateEnabled()`. | [Built-in translation](https://docs.nexconn.ai/chatsdk-web/builtin-translation/overview) | `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Source language detection | Pass `'auto'` as the source language to let Nexconn detect it. | [Translation tasks](https://docs.nexconn.ai/chatsdk-web/builtin-translation/translation-tasks) | `src/client/chat/nexconn.ts` | `IMPLEMENTED` |
| Translation mode | Only `TranslateMode.MECHANICAL (0)` is documented/available. | [Translation tasks](https://docs.nexconn.ai/chatsdk-web/builtin-translation/translation-tasks) | — | `VERIFIED` |
| Language code mapping | The docs use ISO 639-1 style codes (`zh`, `en`). Vaani Room's codes are ISO 639-1 as well, so they are passed through unchanged. Full coverage for `mr`, `gu`, `ta`, `te`, `bn`, `kn`, `ml`, `pa`, `or`, `ur` is not documented per language pair. | [Translation tasks](https://docs.nexconn.ai/chatsdk-web/builtin-translation/translation-tasks) | `src/lib/domain.ts` (`LANGUAGE_CODES`) | `NEEDS-CONSOLE-CONFIRMATION` — enable and test each pair |
| Server-side translation result | Not possible: results are delivered only to the connected client. The server adapter therefore reports `unavailable` with an honest reason instead of fabricating a translation. | [Translation events and results](https://docs.nexconn.ai/chatsdk-web/builtin-translation/translation-events-and-results) | `src/server/translation/nexconn.ts` | `BLOCKED` (by design — the seam is filled by the browser transport) |
| App-level translation (non-Nexconn) | Vaani Room ships a **key-free** provider so real translation works without any Console change or paid plan: `GET https://api.mymemory.translated.net/get?q=<text>&langpair=<src>|<tgt>` (no API key; `q` ≤ **500 bytes**; optional `de=<email>` raises the anonymous quota). Selected with `TRANSLATION_PROVIDER="mymemory"`. | [MyMemory API spec](https://mymemory.translated.net/doc/spec.php) | `src/lib/translation/mymemory.ts`, `src/server/translation/mymemory.ts`, `src/app/api/translate/route.ts`, `src/app/join/[code]/join-room-client.tsx` | `IMPLEMENTED` + `AUTOMATED_TESTED` (21 translation tests) + `LIVE-TESTED (probe)` (§I.3) — browser GUI `NEEDS_VERIFICATION` |
| LibreTranslate as a fallback | Kept for a self-hosted endpoint. Public instances were probed live and are unusable. | [LibreTranslate API](https://libretranslate.com/docs/) | `src/server/translation/libretranslate.ts` | `BLOCKED` — no reachable public endpoint (§I.3) |
| Billing | Translation is billed per translated character with a per-plan free allowance, charged daily. | [Built-in translation](https://docs.nexconn.ai/chatsdk-web/builtin-translation/overview) | — | `NEEDS-CONSOLE-CONFIRMATION` |
| Fallback behaviour | If translation is unavailable, the original text stays visible. | Internal rule | `PassthroughTranslationProvider` in `src/server/translation/passthrough.ts` | `IMPLEMENTED` |

---

## G. Account capabilities and limits

| Requirement | Verified contract | Official source | Current code location | Status / blocker |
|---|---|---|---|---|
| Concurrent open channels | Free plan: 50 concurrent open channels per App Key. Starter/Pro: unlimited. | [Open channel overview](https://docs.nexconn.ai/platform-chat-api/open-channel/overview) | — | `NEEDS-CONSOLE-CONFIRMATION` — the team's plan |
| Participants per open channel | No documented participant limit. | [Open channel overview](https://docs.nexconn.ai/platform-chat-api/open-channel/overview) | — | `VERIFIED` |
| Offline delivery | Open Channels deliver to active participants only — no offline messages and no push for open-channel messages. Offline participants are dropped automatically. | [Open channel overview](https://docs.nexconn.ai/platform-chat-api/open-channel/overview) | History is served from the application database instead (`prisma/schema.prisma`) | `IMPLEMENTED` |
| Local history on leave | The SDK clears local open-channel message history when a user exits the channel. | [Send an open channel message](https://docs.nexconn.ai/platform-chat-api/message/open-channel/send-open-channel) | Application-side history in `Question` / `Answer` | `IMPLEMENTED` |
| Server API rate limits | Token issue 200/sec; open channel create/destroy 100/sec; open channel message 100/sec (counted per target channel). | [Endpoint list](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/chat-server-api-list), [Send an open channel message](https://docs.nexconn.ai/platform-chat-api/message/open-channel/send-open-channel) | `src/server/nexconn/client.ts` (no client-side throttling yet) | `IMPLEMENTED` — Vaani Room's own limiter is `src/server/auth/rate-limit.ts` |
| Open-channel message retention | Cloud retention requires the Open Channel cloud retention service and is off by default. | [Send an open channel message](https://docs.nexconn.ai/platform-chat-api/message/open-channel/send-open-channel) | Application database is the source of truth | `NEEDS-CONSOLE-CONFIRMATION` |
| Sandbox restrictions | The documentation reviewed does not describe a sandbox tier. | — | — | `UNVERIFIED` |

---

## H. Open items

The eight uncertainties the task brief asked to close. Each is now either
**resolved** (with the evidence and the §I probe row that closed it) or
**`NEEDS-CONSOLE-CONFIRMATION`** (with the exact question to ask Nexconn).

1. **No Console access (partially resolved).** A signed server-to-server probe
   reached the account's live host on 2026-11-12 (see §I) and closed items 2, 3,
   4 and 7. Everything that still depends on a **Console setting** — the
   account's token-expiry value, its plan/limits, translation enablement, the
   registered webhook URL, and per-event payload shapes — remains
   `NEEDS-CONSOLE-CONFIRMATION` and requires the team lead to read the Console.
2. **Region — resolved for this account.** The configured host
   `https://api.sg-light-api.com` returned `code: 0` on all four probed
   endpoints, so the account's region is Singapore. The value is still read from
   `NEXCONN_API_BASE_URL`; the provider throws a clear configuration error when
   it is missing rather than guessing. **Confirm** the production region in the
   Console before deploying.
3. **Open channel `channelId` — resolved.** Live probe: a 64-character id was
   accepted and the same id at 65 characters was rejected (HTTP 400 /
   `code 1002`). **Maximum length is 64 characters.** The Vaani room-id scheme
   (lowercase alphanumeric cuid) is comfortably inside that bound.
4. **Token expiry — still `NEEDS-CONSOLE-CONFIRMATION`.** The live probe
   confirmed a token is issued (`result.userId` + `result.accessToken`), but the
   docs state tokens are indefinite **by default** and the actual expiry is a
   Console setting. `ChatUserToken.expiresAt` remains a Vaani-side refresh hint.
   **Ask the team lead:** "What is this App Key's access-token expiry setting in
   Console → Chat → Chat settings?"
5. **Translation results.** They arrive on the client only, so the server
   translation adapter remains honest about being unavailable. Not a probe
   target (needs the browser UI plus translation enabled). **Partly
   resolved for the product:** real end-to-end translation is served by a
   key-free provider selected as `TRANSLATION_PROVIDER="mymemory"` (see §F and
   §I.3), so the app no longer depends on the Console toggles below. Nexconn's
   own translation path stays `NEEDS-CONSOLE-CONFIRMATION`.
6. **Webhook payload shapes — still `NEEDS-CONSOLE-CONFIRMATION`.** The receiver
   verifies and archives events but does not yet interpret per-event payloads.
   **Ask:** register `${APP_BASE_URL}/api/webhooks/nexconn` in the Console and
   capture one real delivery of each event type before adding a domain handler.
7. **Server message sender id — resolved.** Live probe: publishing as the
   unregistered id `vaaniSystem` returned HTTP 200 / `code 0` with one
   `messageId`. The server can publish as `vaaniSystem` without registering it.
8. **`NEXCONN_WEBHOOK_SECRET` is not a Nexconn contract.** Webhooks are signed
   with the App Secret. The variable is kept empty and unused.

---

## I. Live verification log

The task brief (§8) permits a live smoke test only when credentials exist and
forbids fabricating results. This section records exactly what was exercised and
what remains.

### I.1 Server-to-server probe — 2026-11-12 — `LIVE-TESTED (probe)`

A throwaway Node script (`_nexconn-probe.mjs`, deleted immediately after the
run) signed requests with the configured App Key/App Secret and called the
configured regional host. No secret, token or signature value was logged or
committed; only the following non-sensitive summary was captured:

| Step | Endpoint | Result | Conclusion |
|---|---|---|---|
| Base host | — | `https://api.sg-light-api.com` | Account region is Singapore |
| Issue token | `POST /v4/auth/access-token/issue` | HTTP 200, `code 0`, `result.userId` present, `result.accessToken` 96 chars | §D token issue works live |
| Create channel (id = 64 chars) | `POST /v4/open-channel/create` | HTTP 200, `code 0` | `channelId` max length ≥ 64 |
| Create channel (id = 65 chars) | `POST /v4/open-channel/create` | HTTP 400, `code 1002` | `channelId` max length = **64** |
| Send message as `vaaniSystem` | `POST /v4/open-channel/message/send` | HTTP 200, `code 0`, one `messageId` | Unregistered server sender accepted |
| Destroy channel | `POST /v4/open-channel/destroy` | HTTP 200, `code 0` | Channel teardown works live |

This closes uncertainties 1 (region), 3 (`channelId`) and 4 (sender id), and
proves signature generation, the response envelope (`{ code, result }`) and the
`App-Key`/`Nonce`/`Timestamp`/`Signature` headers are accepted by the live host.

### I.2 End-to-end smoke test — not run — `LIVE-TESTED (smoke)` pending

The browser flow has **not** been driven end to end. It requires a human with:

1. **Console access** to register the webhook URL
   (Console → Chat → Chat settings → Webhooks) and to read the token-expiry,
   plan and translation settings.
2. **A publicly reachable HTTPS origin** for `APP_BASE_URL` (webhook delivery
   needs a public receiver; `localhost` will not receive real deliveries).
3. **A browser session** for the host and a second session for a student.

Exact steps for the team lead (each maps to a §10 report item):

1. Set `.env` from the Console: `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`,
   `NEXCONN_API_BASE_URL` (Singapore confirmed), `APP_BASE_URL` (public HTTPS).
2. `npm run dev`; confirm `GET /api/health` reports the database connected.
3. Register a lecturer account, create a room, open `/host/rooms/<joinCode>`.
4. In a second browser, open `/join/<joinCode>`, join, submit a question.
5. Confirm the participant row and the server-issued token (App Key + token only
   in the response — never the App Secret).
6. Confirm `useLiveRoom` reaches `live` in both sessions (the live badge).
7. Send a message from each side and confirm the other session receives it.
8. Confirm the question persists and the UI updates.
9. Confirm a webhook delivery lands on `/api/webhooks/nexconn`, passes signature
   verification, and a replay returns `duplicate: true`.
10. Close the room from the host console and confirm `/join/<joinCode>` reports
    the room closed.
11. Enable translation in the Console and confirm a `translation.updated` event.
12. Stop the Nexconn credentials and confirm the `local` provider and
    `passthrough` translation fall back honestly.

### I.3 Translation provider reachability probe — 2026-11-12 — `LIVE-TESTED (probe)`

Real HTTP requests were made (no credentials involved, no key required) to pick
a provider for Phase 3. Only non-sensitive outcomes are recorded:

| Provider | Request | Result | Conclusion |
|---|---|---|---|
| MyMemory (key-free) | `GET https://api.mymemory.translated.net/get?q=Good morning students&langpair=en\|hi` | HTTP **200**; `responseData.translatedText` = a real Hindi translation, `match` 0.85 | Usable server-side with **no API key** → chosen as the `mymemory` provider |
| Google Translate web endpoint | `GET translate.googleapis.com/translate_a/single?client=gtx&...` | HTTP 200 with a real translation | Works, but it is an **undocumented** endpoint with no terms/quotas to rely on, so it was **not** used |
| LibreTranslate — `translate.terraprint.co` | `POST /translate` | HTTP **502 Bad Gateway** | Unusable |
| LibreTranslate — `libretranslate.com` | `POST /translate` | HTTP **400 Bad Request** | Unusable (public instance requires an API key) |

Consequences:

- `TRANSLATION_PROVIDER="mymemory"` is the shipped real provider
  (`src/server/translation/mymemory.ts`, `src/lib/translation/mymemory.ts`).
- `passthrough` stays the default and is explicitly a **development/test mode**.
- `libretranslate` is retained only for a self-hosted endpoint.
- The provider failure paths are enforced by unit tests
  (`src/lib/translation/mymemory.test.ts`): HTTP error, network/timeout,
  unparsable body, `quotaFinished`, a non-200 `responseStatus`, and an empty
  translation all produce `unavailable`, never the original text.
- **Not verified:** the browser GUI. No browser-automation tool is available in
  this environment, so the translate control has been exercised only through
  unit tests and the provider probe, never by clicking in Chrome.


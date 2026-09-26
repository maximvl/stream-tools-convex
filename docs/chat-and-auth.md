# Chat Infrastructure & Auth

## Chat polling

- `ChatMessagesStore` — `connections` (`LocalStore('chat-connections')`),
  per-connection statuses, `messages[]`, `newMessages[]` (last poll delta),
  `messagesByUser/usersById`, `lastMessagePerConnection`. Provided app-wide
  by `StoreProvider` (`setContext('chat-store')`).
- `ChatChannelSync.svelte` — one stable instance per configured channel
  (keyed by config, never by status, so polling survives reconnects):
  `chatConnect` query until `connected` (backoff 3s→60s), then
  `fetchMessages` every 2s (`ts = lastTs − 10s` overlap), dedupe by message
  id, tag `source{server, channel}`; 5-error streak → `disconnected`.
- Transport: frontend `lib/api.ts` → `https://chats.eventlab.dev/api/...`;
  backend mirror `convex/chatService.ts` (`fetchChatMessages/Batch`,
  fail-open `[]`, `Promise.allSettled` fan-out) for the confirm actions.
  `ConnectionDialog` manages the connection list.
- Feature pages consume chat via `$effect(() => { store.newMessages... })`
  and route messages into their handlers (loto, vote, turnir voting, word,
  hex game). Per-platform fields (`twitchFields`, `vkFields`, …) carry
  badges/colors/roles/subscriptions.

## Sessions & channel-ownership auth

- One browser-wide session id (`convex-app:session` in localStorage),
  **minted only by the backend** (`api.auth.check` with no session, or
  `authLib.mintSession`). `mintSingleFlight` guarantees one mint per page
  load across mounting channels. `user_auth` holds one row per channel
  sharing the session — one session owns many channels.
- Proof of ownership is chat-based: `api.auth.check` returns a 5-char
  `auth_key` (one shared code per session, 1h TTL); the streamer sends
  `+мой <code>` in chat; `api.auth.confirm` verifies the key appeared from
  the channel owner and upserts `user_auth`. `AuthChannel` bootstraps
  (check + mint) and mirrors a live `isAuthenticated` subscription into
  `AuthStore`; `AuthDialog` renders confirm state per connection.
- Backend writes are owner-gated (fail closed while auth loads): loto
  mutations require `owner_session_id` match; RPS ownership is channel
  identity (re-authed browsers pass). Loading history (tickets, matches) is
  public and never requires auth.
- Housekeeping: hourly crons evict expired `auth_keys`, 24h-old
  `loto_tickets`, 7-day-expired `loto_bans`. `frontend_logs` lets authed
  frontends ship diagnostics to the backend.

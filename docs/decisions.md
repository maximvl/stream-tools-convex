# Architecture Decisions (ADRs)

## 1. Frontend generates, backend backs up (loto)

Tickets and rolls are created in the browser (chat polling + animation
timing live there); Convex is the cold backup and cross-tab bus, not the
game engine. Consequence: ticket list applies the first subscription payload
per game only (no echo overwrites/reorder replays); draws sync live as
source of truth. Refresh restores, live play never flickers.

## 2. One session per browser, many channels per session

`user_auth` rows share a single `localStorage` session id across all of the
streamer's channels (migrated from per-channel keys). All loto games and RPS
ownership resolve through it. Rationale: one browser = one streamer
identity; multi-channel games need a shared owner.

## 3. Channel identity beats session (RPS)

RPS participants store `(platform, user_slug, via)` — no session. A viewer
with a new browser that re-proves the same nick recovers their entries.
Same for tournament ownership (`owner_stream_channel`). Sessions are lookup
keys, identity is the data.

## 4. Synthetic streamer ids

Streamer tickets use `streamer/<server>/<channel>` as `owner_id` on both
sides, so generated tickets and the streamer's own `+лото` messages upsert
instead of duplicating. Pre-scheme rows age out via the 24h eviction.

## 5. Auto-rotation over manual cleanup

Stale (20h + empty board) and long-finished (10 min) loto games rotate to a
fresh row automatically, sharing one attempt per game id; failures re-arm.
Rationale: streamers open the page and expect today's game, never
yesterday's rolls. Same rules apply degraded: without backend the dead
binding is dropped locally. Live games with tickets are never touched.

## 6. Never brick the UI on sync

Blocking loaders always have an escape: 10s watchdog → local mode + banner,
manual "continue without loading", settled-`null` → drop zombie id, error →
empty state. Fresh (session-less) users never enter the loading state at
all, since nothing is restored.

## 7. Guard in-flight async work by generation

Roll animation continuations and rotation attempts are invalidated by newer
resets (`rollGeneration`, `rotationAttemptedFor`, `ensuringGame`,
`syncedFor` per game). A reset during a roll or a double-clicked "new game"
can't leak numbers into the fresh board or mint duplicate games.

## 8. Local-first for stream games, backend for history

Turnir/vote/word/hex run fully in-page (chat in, no backend rows) — zero
backend dependency during a live show. Convex persists what must survive
reloads and be shared: loto games/tickets, RPS tournaments, winners, bans,
auth. TTLs match the domain: tickets 24h, bans 7d, auth keys 1h, game rows
forever (rotation, not eviction, retires them).

## 9. Query-layer separation

`convex-svelte useQuery` for Convex subscriptions; TanStack Query reserved
for the external chats API. Keeps caching/retry semantics of two different
transports from interfering.

## 10. Fail-open chat, fail-closed auth

Chat polling degrades to `disconnected` + backoff and never crashes pages;
missing/loading auth reads as _not_ authenticated for writes, while reads
(history, rosters, matches) stay public.

## 11. Platform priority as tiebreak

`twitch > kick > vkvideo > wtv` decides the "main" channel everywhere
(streamer ticket, session representative, RPS slug clashes). One rule,
every surface.

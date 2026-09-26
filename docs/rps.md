# RPS Tournaments (`/rps`)

Rock-paper-scissors knockout tournaments. The streamer manages from
`StreamerDashboard`; viewers join and play from `ViewerPanel`.
Route `[channel]/+page.svelte` picks the view: if the session owns the
tournament's `owner_stream_channel` → dashboard, else viewer panel.

## Backend (`convex/rps*.ts`)

- `rps.ts` — `create` (owner = session's primary channel, status
  `registration`), `start` (needs ≥1 active participant), `list`/`get`/
  `getByOwnerChannel` (public; prefers registration > running > finished,
  platform priority on slug clash), `participants` roster, `myEntries`
  (entries resolved from session → identities), `join`.
- `rpsMatches.ts` — `makeRound` (Swiss pairing by wins desc, carry-down,
  odd player faces a `BOT` with a pre-rolled random move), per-match
  `deadline_at = now + round_seconds` (10s) with `scheduler.runAt(resolve)`;
  `submitMove` (opponent move hidden until resolved, early resolve when both
  moved); `resolveMatch` (idempotent: no-show loses, double no-show both
  eliminated, bot never advances, draws replay same round); `advanceRound`
  (1 human left → champion + `finished`, 0 → winnerless finish).
- `rpsAuth.ts` — viewer onboarding via `rps_codes`: `requestCode` mints a
  5-char key (1h TTL, one row per tournament+viewer session); `confirm`
  (action) scans the last 5 min of owner chats for the key and records
  `Proof{via_stream_channel, platform, user_slug, display_name}`.
- `rpsLib.ts` — validators, `requireOwner` (ownership = channel identity,
  so a re-authed browser passes), shuffle/outcome helpers.

## Viewer onboarding flow

1. Viewer opens `/rps/<channel>` → bare session minted → code requested.
2. Viewer pastes `+мой <code>` into the streamer's chat(s).
3. Backend finds the key in chat, records the proof, links the viewer's
   session to the identity (`user_auth`), auto-joins the tournament.
4. Already-authed sessions auto-join; pasting the code in several chats
   creates multiple entries (one per `via_channel`).

## Runtime

- Fully automatic after Start: rounds pair, deadlines tick (`Countdown`,
  red pulse ≤5s), moves submit via `MoveBoard`, resolution and advancement
  run server-side on the scheduler. The streamer only observes
  (`RoundMatches`, champion banner).
- Moves are hidden until resolved (`matchesForRound`), each entry sees its
  own board + history via `myEntries`/`myMatches`.
- Identity model: participation is keyed by `(platform, user_slug, via)`,
  never by session — a new browser that re-proves the same nick recovers
  its boards. `RpsChatProvider` only enriches chat cosmetically.

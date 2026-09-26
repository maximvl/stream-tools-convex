# Loto (`/loto`)

Bingo game. Viewers register tickets by typing `+лото` (optionally followed
by their own numbers) in chat; the streamer rolls numbers; the first ticket
with `win_matches_amount` (default 3) sequential matches wins.

## Ticket types

- **Chat tickets** — created in the frontend from chat polling
  (`LotoStore.handleMessage`). One per owner ("last message wins", upsert on
  `owner_id`). Text after `+лото` is parsed for numbers 1–`max_number`;
  missing numbers are sampled from the remaining pool.
- **Points tickets** — highlighted Twitch messages and VK bot mentions
  (points redemption), attributed to the mentioned user.
- **Streamer ticket** — generated for the main channel (platform priority),
  stored under the synthetic id `streamer/<server>/<channel>` so a later
  `+лото` from the streamer upserts it instead of duplicating.
- **Latecomers / config** — `ticket_size` (8), `max_number` (99),
  `allow_tickets_after_start`, `only_subscribers`, mod number input — all in
  a `LocalStore`-backed config (`loto-config` key).

## State & sync

- `src/lib/stores/lotoStore.svelte.ts` — game state machine
  (`registration | playing`), draw pool, tickets, winner derivation
  (score = `maxSeq*1000 + totalMatches`), supergame, bans, chat handling.
- Page (`src/routes/loto/+page.svelte`) wires backend persistence:
  `ticketSaver / drawPusher / winnerReporter / ticketRemover / banSaver`.
- Sync components mount only when a `gameId` exists (this `convex-svelte`
  version has no `skip`): `LotoTicketsSync` (first payload per game only —
  the live list is frontend-owned, backend is a cold backup for refresh
  restores), `LotoGameSync` (draws sync live — source of truth for all tabs),
  `LotoBansSync`.
- While `gameId` is set but subscriptions haven't settled, the page shows
  "Загрузка игры…". A 10s watchdog (`LOTO_SYNC_TIMEOUT_MS`) unblocks into
  local mode with an offline banner; a settled-`null` game drops the zombie
  binding so a fresh game can be minted.

## Game lifecycle (backend games)

1. **Attach** — `ensureGame()`: with an authed session it creates a
   `loto_games` row (flushing locally collected draws/tickets first so
   mid-game auth doesn't lose progress); otherwise the game stays
   page-local. Subsequent channel changes only `setChannels`.
2. **Resume** — the game id is kept in `LocalStore('loto-game-id')` and
   restored on load when a session exists.
3. **Stale rotation** — a loaded game older than `LOTO_GAME_STALE_AFTER_MS`
   (20h, both sides) **and** with an empty board auto-rotates to a fresh
   game. Live games with tickets never rotate. Without backend, a dead
   binding is dropped locally instead.
4. **Finished rotation** — a game finished (`finished_at`) more than
   `FINISHED_GAME_ROTATE_AFTER_MS` (10 min) ago, or carrying a winner from
   before `finished_at` existed, auto-rotates ("autostart after timeout").
   One attempt per game id; a failed create re-arms for retry.
5. **Winner reporting** — the frontend derives the winner and reports it
   (`setWinner`; `markFinished` stamps `finished_at` for local temp-id rows
   that `setWinner` can't accept). Ticket creation stops while a winner is set.

## Supergame, winners, bans

- **Supergame** — winner's bonus round: guess `super_game_guesses_amount`
  (7) cells out of `super_game_options_amount` (99) hiding 1/2/3-pointers,
  bombs (−1) and VK-role rewards; score ≥ `super_game_win_score` wins.
  Guesses arrive via winner's chat messages; bonus guesses optional.
- **Winners history** — `loto_winners` rows (`username`,
  `super_game_status: win|lose|skip`) per stream channel, shown by
  `LotoWinners`.
- **Bans** — 7-day ban on `server/channel/display_name` (case-insensitive);
  banned users' tickets are filtered locally and rejected server-side;
  rows evicted hourly by cron.

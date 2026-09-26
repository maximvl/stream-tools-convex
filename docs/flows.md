# Key Flows

## Loto page open (returning streamer)

1. `LocalStore('loto-game-id')` + `getSessionId()` restore the backend game
   synchronously → `setGameId` arms the sync watchdog and mounts
   `LotoTicketsSync` / `LotoGameSync` / `LotoBansSync`.
2. Subscriptions settle → tickets (first payload), draws (live), bans apply;
   "Загрузка игры…" clears. Watchdog (10s) or "Продолжить без загрузки"
   unblocks if they stall; settled-`null` drops a zombie binding.
3. `ensureGame()` reacts to session/channels/auth: game bound → only
   `setChannels`; unbound → create (flushing local draws/tickets first).
4. Dead restored games auto-leave: stale-old-and-empty or finished-long-ago
   → backend rotation when authed, local drop when not. A failed create
   re-arms for retry.

## Loto round

`+лото` in chat → `handleMessage` → optimistic ticket (last-message-wins per
owner) → `ticketSaver` persists (cold backup, no live echo). Streamer ticket
via `addStreamerTicket` (upsert on synthetic id; response inserted directly
since there is no live re-sync). "Начать" → `playing`; "Ролл" →
`rollNextNumber` (animation, then push + `drawPusher`; backend stores as
source of truth, echoed to all tabs). Winner derived at
`win_matches_amount` sequential matches → `winnerReporter`/`markFinished`
stamp the backend; ticket creation halts. "Новая игра": backend → fresh row;
offline → drop binding + local reset (survives re-auth via `ensureGame`
flush). Mid-roll resets cancel the in-flight roll by generation.

## RPS viewer onboarding

Open `/rps/<channel>` → bare session → `requestCode` → paste `+мой <code>`
in streamer chat → `confirm` finds key → proof + `user_auth` link →
auto-`join` (one entry per `via_channel`). Moves via `MoveBoard`;
`submitMove` hides opponent move; scheduler resolves on deadline or when
both moved; draws replay; `advanceRound` crowns champion or pairs next
Swiss round.

## Auth confirm (streamer channel)

Connect chat → `AuthChannel` bootstrap (`auth.check`: verify-or-mint session

- fresh key) → copy `+мой <code>` → send in own chat → `confirm` action
  verifies via chat API → `user_auth` upsert → `isAuthenticated` flips live →
  backend mode unlocks (loto persistence, history).

## Offline / degraded backend

No session or no auth → pure frontend mode (loto playable, nothing stored).
Stalled subscriptions → watchdog unblocks after 10s with an offline banner;
late arrivals converge. Ghost game ids are dropped, not retried forever.
Chat polling is fail-open (error streak → `disconnected`, backoff reconnect).

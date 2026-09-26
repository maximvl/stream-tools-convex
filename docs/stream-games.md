# Other Stream Games

All of these are **frontend-only** (no Convex rows): chat-driven, state in
Svelte stores, config in `LocalStore` where persistence matters.

## Turnir (`/turnir`) — knockout picker

The streamer reduces N text candidates to one winner. `TurnirStore` is an
explicit state machine:
`EditCandidates → Start → RoundStart/RoundChange → Victory`, with
`roundNumber/roundId/currentRoundType`. Items carry
`Active|Eliminated|Excluded` status plus mechanics flags (`isProtected`,
`isResurrected`, `swappedWith`, deals). Only `TurnirSettings`
(`noRoundRepeat`, `subscriberOnly`, round types) persists (`turnir-settings`
key); items are in-memory (10 defaults, +10). Round types: classic
(`RandomElimination`, `StreamerChoice`, `ViewerChoice`) and bonus
(`Protection`, `Swap`, `ClosestVotes`, `Resurrection`, `Deal`, …).
`turnirVoting` is a per-round instance (`{#key roundId}`), last-vote-wins per
user, votes are messages equal to the item id; `subscriberOnly` checks VK
subscription badges. ~24 components under `components/turnir/` (wheel,
dialogs per round type, votes log, victory screen). Soundtrack via
`musicStore` (`/static/media/*.mp3`: wheel, victory, thinking, …).

## Vote (`/vote`) — generic poll

`VotingStore`: numbered options (`voting-options` key) + duration, votes as
`SvelteMap<UserId, {optionIndex, server}>`, embedded `TimerStore` that
auto-ends on `finished`. Messages with `parseInt(text) ∈ 1..N` count as
votes (last vote wins). Derived stats: totals, per-option counts/percentages,
per-server breakdown, winner(s). Page feeds `chatStore.newMessages` into the
store and renders option cards + voting log.

## Word (`/word`) — guess-the-word

No store: streamer sets a secret (masked input); the page derives from
`chatStore.messages` — same-length messages shown as attempts, first
case-insensitive exact match wins and auto-reveals. List truncated at the
winner, newest first.

## Hex battle royale (`/game`) — Phaser

Chatters typing `+игра` (once per user, locked after start) become
`HexPlayer`s on a 2.5D hex grid (`hexGrid.ts`: pointy-top axial math,
perspective squash). `MainScene` (~1300 lines) animates escalating
eliminations (`fire()`), shields, resurrection, reshuffle; Svelte syncs via
scene events + 100ms polling fallback, with a 20s new-game cooldown, winner
banner and winner chat history.

## Shared: music & timer

- `musicStore` — turnir soundtrack state (`volume/muted` persisted);
  actual `<audio>` toggling lives in `MusicAudio.svelte`.
- `timerStore` — `Temporal`-based count-up with optional `limitMs`,
  `start/pause/resume/stop`, derived passed/remaining parts, auto
  `finished`; used by vote countdown and loto timer UI.

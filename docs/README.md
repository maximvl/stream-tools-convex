# Streamer Games — System Documentation

Browser-based toolkit for running interactive chat games on stream
(loto, RPS tournaments, knockout turnirs, polls, word game, hex battle
royale). The streamer opens a page, connects chats, viewers participate by
typing in chat.

## Stack

- **Frontend:** Svelte 5 + SvelteKit (`ssr = false`, `adapter-static` → `build/`),
  Tailwind 4, Phaser 3 (hex game), `convex-svelte` for backend subscriptions,
  TanStack Query **only** for the external chats API.
- **Backend:** Convex (TypeScript) — queries / mutations / actions / crons.
  Two deployments: dev (`colorless-hamster-693`) and prod
  (`enduring-porcupine-996`).
- **Chat transport:** external polling API (`https://chats.eventlab.dev`),
  frontend direct + backend mirror (`convex/chatService.ts`). Platforms:
  `twitch | kick | vkvideo | wtv`.

```
chat platforms ──poll──▶ frontend pages ──mutations/queries──▶ Convex
(EventLab API)         (Svelte stores)      (convex-svelte)      (cron eviction)
```

## Docs map

- `loto.md` — bingo game: tickets, draws, winners, supergame, bans, game lifecycle.
- `rps.md` — rock-paper-scissors tournaments (streamer dashboard + viewer flow).
- `stream-games.md` — turnir, vote, word, hex game (`/game`), music, timer.
- `chat-and-auth.md` — chat polling infra, sessions, channel-ownership auth.
- `flows.md` — end-to-end sequences (page open, new game, winner, offline).
- `decisions.md` — architecture decision records (ADRs).

## Environments & commands

| File              | Purpose                                               |
| ----------------- | ----------------------------------------------------- |
| `.env.local`      | dev Convex URLs (used by `vite dev`)                  |
| `.env.production` | prod Convex URL (used by `pnpm build`)                |
| `local/`          | self-hosted Convex via docker compose for dev/testing |

```bash
pnpm dev            # frontend (Vite)
pnpm convex:dev     # Convex dev backend
pnpm check          # svelte-check (type errors)
pnpm lint           # prettier --check + eslint
pnpm build          # static production build → build/
pnpm local:up       # local Convex backend (docker)
```

## Key concepts (glossary)

- **Session** — one id per browser (`localStorage: convex-app:session`),
  minted only by the backend. Shared across all of the streamer's channels.
- **Stream channel** — `platform/user_slug`, e.g. `twitch/shroud`. Case-insensitive.
- **Game id (loto)** — instance id (`loto_games` row). Ticket/draw queries are
  scoped to it, so a new game never shows old tickets.
- **Backend mode vs frontend mode (loto)** — with an authed session the game
  persists to Convex; without one everything runs in page-local state.
- **Platform priority** — `twitch > kick > vkvideo > wtv`, used everywhere a
  "main" channel is picked (streamer ticket, session representative, RPS slug clashes).

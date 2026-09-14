<script lang="ts">
  import ConnectionDialog from '$lib/components/connections/ConnectionDialog.svelte'
  import LotoSettingsDialog from '$lib/components/loto/LotoSettingsDialog.svelte'
  import { getChatStore } from '$lib/context'
  import { getLotoConfigStore, LotoStore, setLotoStore } from '$lib/stores/lotoStore.svelte'
  import { TimerStore } from '$lib/stores/timerStore.svelte'

  import { untrack } from 'svelte'

  import LotoTicket from '$lib/components/loto/LotoTicket.svelte'
  import LotoLogo from '$lib/components/loto/LotoLogo.svelte'
  import LotoWinnerBanner from '$lib/components/loto/LotoWinnerBanner.svelte'
  import PlatformTicketCounts from '$lib/components/loto/PlatformTicketCounts.svelte'
  import SlotDigit from '$lib/components/loto/SlotDigit.svelte'
  import { Button } from '$lib/components/ui/button'
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'
  import Nav from '$lib/components/layout/Nav.svelte'
  import SuperGame from '$lib/components/loto/supergame/SuperGame.svelte'
  import LotoWinners from '$lib/components/loto/LotoWinners.svelte'
  import { createQueries } from '@tanstack/svelte-query'
  import { useConvexClient } from 'convex-svelte'
  import type { Id } from '../../../convex/_generated/dataModel.js'
  import { getSessionId } from '$lib/session'
  import { LocalStore } from '$lib/stores/localStore.svelte'
  import {
    addLotoTicket,
    createLotoGame,
    setLotoChannels,
    removeLotoTicket,
    pushDrawnNumber,
    setLotoWinner,
    addStreamerTicket,
    banLotoUser,
  } from '$lib/api/lotoTickets'
  import { fetchVkRoles } from '$lib/api'
  import type { ChatServer } from '$lib/types'
  import { BackgroundImages, LOTO_GAME_STALE_AFTER_MS } from '$lib/constants'

  import BgPattern5 from '$lib/components/common/BgPattern5.svelte'
  import LotoTicketsSync from '$lib/components/loto/LotoTicketsSync.svelte'
  import LotoGameSync from '$lib/components/loto/LotoGameSync.svelte'
  import LotoBansSync from '$lib/components/loto/LotoBansSync.svelte'
  import { NumberToFancyName } from '$lib/components/loto/utils'
  import TicketPanel from '$lib/components/loto/TicketPanel.svelte'
  import { AuthStore } from '$lib/stores/authStore.svelte'
  import AuthDialog from '$lib/components/auth/AuthDialog.svelte'

  const lotoConfig = getLotoConfigStore()
  const lotoStore = new LotoStore(lotoConfig)
  setLotoStore(lotoStore)
  const store = getChatStore()
  const countdownTimer = new TimerStore()
  let addingStreamer = $state(false)

  const authStore = new AuthStore()
  lotoStore.setAuthStore(authStore)

  // ---- Backend loto game (instance id) ----
  const convex = useConvexClient()
  const gameIdStore = new LocalStore<string | null>('loto-game-id', null)
  if (gameIdStore.value) {
    lotoStore.setGameId(gameIdStore.value)
  }
  lotoStore.ticketRemover = (ticketId: string) => {
    removeLotoTicket(convex, ticketId as Id<'loto_tickets'>).catch(() => {})
  }
  lotoStore.banSaver = (ticketId: string) => {
    banLotoUser(convex, ticketId as Id<'loto_tickets'>).catch(() => {})
  }
  lotoStore.ticketSaver = (draft) => {
    if (!lotoStore.gameId) return
    addLotoTicket(convex, lotoStore.gameId as Id<'loto_games'>, draft).catch(() => {})
  }
  lotoStore.drawPusher = (number: string) => {
    if (!lotoStore.gameId) return
    pushDrawnNumber(convex, lotoStore.gameId as Id<'loto_games'>, number).catch(() => {})
  }
  lotoStore.winnerReporter = (ticketId: string | null) => {
    if (!lotoStore.gameId) return
    setLotoWinner(
      convex,
      lotoStore.gameId as Id<'loto_games'>,
      ticketId as Id<'loto_tickets'> | null,
    ).catch(() => {})
  }

  // Stream channels for the game, from connected chats (lowercased match backend).
  const gameChannels = $derived(store.connectedConnections.map((c) => c.toLowerCase()))

  // Owner-only gate for the streamer-ticket button: this session must have
  // proved ownership of every active channel (fail closed while auth state
  // is still loading — missing entries count as not authed).
  const isChannelOwner = $derived(
    store.connectedConnections.length > 0 &&
      store.connectedConnections.every((c) => authStore.connectionInfo[c]?.authenticated ?? false),
  )

  // Size params for the generated streamer ticket (chat tickets carry their
  // own values from the frontend ticket factory).
  const pollParams = () => ({
    ticket_size: lotoConfig.value.ticket_size,
    max_number: lotoConfig.value.max_number,
  })

  // In-flight guard: without it, rapid connection flaps before the first
  // create resolves would mint duplicate games.
  let ensuringGame = false

  // One rotation attempt per game id: a failed create must not retry-loop.
  let rotationAttemptedFor: string | null = null

  async function ensureGame() {
    if (!getSessionId()) return
    if (gameChannels.length === 0) return
    if (ensuringGame) return
    if (lotoStore.gameId) {
      try {
        await setLotoChannels(convex, lotoStore.gameId as Id<'loto_games'>, gameChannels)
      } catch {
        // Backend unavailable — chat polling still works, tickets just stay local.
      }
      return
    }
    ensuringGame = true
    try {
      // Re-check: a concurrent path may have set the game while awaiting.
      if (!lotoStore.gameId) {
        const res = await createLotoGame(convex, gameChannels)
        gameIdStore.value = res.game_id as string
        lotoStore.setGameId(res.game_id as string)
      }
    } catch {
      // Backend unavailable — chat polling still works, tickets just stay local.
    } finally {
      ensuringGame = false
    }
  }

  $effect(() => {
    void gameChannels.length
    untrack(() => {
      void ensureGame()
    })
  })

  // Auto-rotate stale games: older than LOTO_GAME_STALE_AFTER_MS.
  // Only fires on fully loaded state so unconfirmed
  // optimistic tickets also block rotation; a fresh empty game is young and
  // never matches. Missing channels never block it: the new game starts
  // channel-less and ensureGame syncs channels in when they connect.
  // Reuses newBackendGame for the reset + LocalStore write.
  $effect(() => {
    if (!lotoStore.gameLoaded || !lotoStore.ticketsLoaded) return
    const createdAt = lotoStore.gameCreatedAt
    if (createdAt !== null && Date.now() - createdAt <= LOTO_GAME_STALE_AFTER_MS) return
    const gameId = lotoStore.gameId
    if (!gameId || rotationAttemptedFor === gameId) return
    // No session yet (minted when the first channel mounts) — retry when
    // channels arrive via the gameChannels dep, without consuming the
    // single attempt.
    void gameChannels.length
    if (!getSessionId()) return
    // A concurrent ensureGame create will either mint a fresh game (mooting
    // this) or settle without changes — either way retry on the next change,
    // so don't consume the single attempt here.
    if (ensuringGame) return
    rotationAttemptedFor = gameId
    untrack(() => {
      void newBackendGame()
    })
  })

  async function newBackendGame() {
    // No channels guard: a game with zero channels is valid (channels sync
    // in later via ensureGame) — missing channels or tickets must never
    // block creating a new game.
    if (ensuringGame) return
    ensuringGame = true
    try {
      const res = await createLotoGame(convex, gameChannels)
      gameIdStore.value = res.game_id as string
      lotoStore.setGameId(res.game_id as string)
      lotoStore.newGame()
    } catch {
      // ignore — stays on current game
    } finally {
      ensuringGame = false
    }
  }

  // Per-ticket owner gate for the ban button: this session must have proved
  // ownership of the ticket's own source channel (fail closed).
  function isOwnerFor(ticket: { source: { server: string; channel: string } }): boolean {
    const want = `${ticket.source.server}/${ticket.source.channel}`.toLowerCase()
    const key = store.connectedConnections.find((c) => c.toLowerCase() === want)
    return key ? (authStore.connectionInfo[key]?.authenticated ?? false) : false
  }

  // Generates the streamer ticket for the main channel (backend picks it
  // by platform priority). Upserts, so pressing again re-rolls.
  async function addStreamer() {
    if (!lotoStore.gameId || addingStreamer) return
    addingStreamer = true
    try {
      await addStreamerTicket(convex, lotoStore.gameId as Id<'loto_games'>, pollParams())
    } catch {
      // ignore — e.g. winner already set or backend unreachable;
      // the ticket list subscription shows the outcome either way
    } finally {
      addingStreamer = false
    }
  }

  // Live backend state for the active game instance (subscriptions mount
  // only once a game exists — this convex-svelte version has no 'skip').
  // Tickets are created in the frontend from its chat polling and saved via
  // ticketSaver; the subscriptions below echo the stored rows back (source
  // of truth for reloads and second tabs).

  $effect(() => {
    untrack(() => {
      authStore.connections.length = 0
    })
    store.connections.value.forEach((c) => {
      untrack(() => authStore.add(c))
    })
  })

  const vkConnections = $derived(
    store.connectedConnections.filter((connKey) => connKey.toLowerCase().startsWith('vkvideo')),
  )

  createQueries(() => {
    return {
      queries: vkConnections.map((connection) => {
        return {
          queryKey: ['vk-roles', connection],
          queryFn: async () => {
            const [server, channel] = connection.split('/')
            return fetchVkRoles(server as ChatServer, channel)
          },
        }
      }),
      combine: (results) => {
        results.forEach((result, id) => {
          const roles = result.data?.roles?.data?.rewards
          const conn = vkConnections[id]
          if (roles && roles.length > 0 && conn) {
            lotoStore.vkRolesRewards[conn] = roles
          }
        })
        return results
      },
    }
  })

  function addTime(seconds: number) {
    if (countdownTimer.state === 'finished') {
      countdownTimer.limitMs = 0
    }
    countdownTimer.limitMs += seconds * 1000
    if (countdownTimer.state !== 'active') {
      countdownTimer.start()
    }
  }

  $effect(() => {
    const messages = store.newMessages
    untrack(() => {
      messages.forEach(lotoStore.handleMessage)
    })
  })

  const streamerFirstTicket = $derived(lotoStore.streamerTickets[0])
  const streamerUser = $derived(
    streamerFirstTicket ? lotoStore.usersById.get(streamerFirstTicket.owner_id) : undefined,
  )

  const timerText = $derived(
    `${countdownTimer.remainingMinutesPart.toString().padStart(2, '0')}:${countdownTimer.remainingSecondsPart.toString().padStart(2, '0')}`,
  )
</script>

<svelte:head>
  <title>Лото: {lotoStore.ticketsOrdered.length} билетов зарегано</title>
</svelte:head>

<BgPattern5
  images={BackgroundImages}
  gap={40}
  staggered
  tileSize={50}
  polaroidChance={0}
  maxRotation={18}
  tapeChance={0}
/>

<div class="dark flex flex-col items-center p-8">
  <Nav />
</div>
{#if lotoStore.gameId}
  <LotoTicketsSync gameId={lotoStore.gameId} />
  <LotoGameSync gameId={lotoStore.gameId} />
{/if}
<LotoBansSync channels={gameChannels} />
{#if lotoStore.backendSyncing}
  <div class="dark relative flex flex-col items-center justify-center overflow-hidden p-6">
    <div class="bg-card2 animate-pulse rounded-xl border border-primary/60 p-8 text-2xl">
      Загрузка игры…
    </div>
  </div>
{:else}
  <div class="dark relative flex min-h-screen flex-col overflow-hidden p-6">
    <div class="fixed top-6 left-6 z-10 flex flex-col gap-4">
      <ConnectionDialog />
      <AuthDialog {authStore} />
      <div class="flex gap-2">
        <div class="bg-card2 flex-1 rounded-lg">
          <LotoSettingsDialog />
        </div>
        <Button
          class="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-black tracking-tighter uppercase shadow-lg transition-all hover:scale-105 hover:bg-amber-500 active:scale-95"
          onclick={() => newBackendGame()}
        >
          Новая игра
        </Button>
      </div>
      {#if lotoStore.gameState === 'registration'}
        <div class="bg-card2 flex flex-col gap-2 rounded-xl p-2">
          <div class="text-center">Таймер</div>
          <div class="flex gap-2">
            <Button
              class="h-auto flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black tracking-tighter uppercase shadow-lg transition-all hover:scale-105 hover:bg-blue-500 active:scale-95"
              onclick={() => addTime(60)}
            >
              +1 мин
            </Button>
            <Button
              class="h-auto flex-1 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black tracking-tighter uppercase shadow-lg transition-all hover:scale-105 hover:bg-purple-500 active:scale-95"
              onclick={() => addTime(30)}
            >
              +30 сек
            </Button>
          </div>
        </div>
      {:else}
        <div class="bg-card2 rounded-xl p-1">
          <PlatformTicketCounts tickets={lotoStore.ticketsOrdered} />
        </div>
      {/if}
      <LotoWinners />
    </div>

    <div class="absolute top-30 right-20 w-fit">
      {#if lotoStore.streamerTickets.length === 0 && isChannelOwner}
        <Button
          class="rounded-xl border border-cyan-800 bg-cyan-950 px-4 py-2 text-base font-medium text-cyan-200 transition-colors hover:bg-cyan-900 disabled:opacity-50"
          onclick={() => addStreamer()}
          disabled={addingStreamer}
        >
          {addingStreamer ? 'Добавляем…' : 'Получить билет стримера'}
        </Button>
      {:else if streamerUser}
        {#each lotoStore.streamerTickets as ticket (ticket.id)}
          <LotoTicket
            {ticket}
            user={streamerUser}
            matchedNumbers={lotoStore.drawnNumbers}
            lastRolledNumber={lotoStore.drawnNumbers[lotoStore.drawnNumbers.length - 1]}
            winnerMatchedNumbers={lotoStore.winner?.id === ticket.id
              ? lotoStore.winnerMatchedNumbers
              : []}
            showTimestamp={lotoStore.winnerCandidates.size > 1 &&
              lotoStore.winnerCandidates.has(ticket.id)}
          />
        {/each}
      {/if}
    </div>

    <div class="fixed top-6 right-8 z-50">
      <LotoLogo />
    </div>

    <div class="flex flex-1 flex-col items-center justify-start gap-8">
      {#if lotoStore.gameState === 'registration'}
        <div class="flex flex-col items-center gap-4">
          <div
            class="bg-card2 rounded-xl border border-primary/60 px-6 py-3 shadow-lg ring-1 ring-primary/40"
          >
            <p class="text-xl font-medium text-primary">
              +лото в чат чтобы зарегаться
              <br />можно писать свои числа после +лото
            </p>
            <PlatformTicketCounts tickets={lotoStore.ticketsOrdered} />
          </div>
          <div class="flex items-center gap-6">
            <Button
              class="{countdownTimer.state !== 'active'
                ? 'button-animate'
                : ''} h-auto rounded-xl bg-green-600 px-12 py-6 text-xl font-black tracking-tighter uppercase shadow-xl transition-all hover:scale-105 hover:bg-green-500 active:scale-95"
              onclick={() => lotoStore.start()}
            >
              Начать
            </Button>
            {#if countdownTimer.limitMs > 0}
              <div class="bg-card">
                <div
                  class="flex h-16 items-center justify-center rounded-2xl border-2 px-6 shadow-lg ring-1 transition-all {countdownTimer.remainingSeconds <=
                  30
                    ? 'animate-pulse border-red-500/80 bg-red-900 ring-red-500/50'
                    : 'border-primary/60 bg-card ring-primary/40'}"
                >
                  <div class="flex items-center gap-2">
                    <div
                      class="text-3xl font-black {countdownTimer.remainingSeconds <= 30
                        ? 'text-red-500'
                        : 'text-primary'}"
                    >
                      {timerText}
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {:else}
        {#if lotoStore.winner}
          {@const winnerUser = lotoStore.usersById.get(lotoStore.winner.owner_id)}
          <div class="flex flex-col items-center gap-4">
            <LotoWinnerBanner user={winnerUser} name={lotoStore.winner.owner_name} />
            <Button
              class="h-auto rounded-xl bg-amber-600 px-6 py-4 text-xl font-black tracking-tighter uppercase shadow-xl transition-all hover:scale-105 hover:bg-amber-500 active:scale-95"
              onclick={() => newBackendGame()}
            >
              Новая игра
            </Button>
          </div>
        {:else}
          {@const numStr = lotoStore.displayNextNumber || '00'}
          <div class="flex flex-col items-center gap-6">
            <div class="flex flex-col items-center gap-4 md:flex-row">
              <div
                class="bg-card2 flex flex-col items-center justify-center rounded-2xl border-2 border-primary/60 p-4 shadow-lg ring-1 ring-primary/40"
              >
                <div class="flex gap-1">
                  <SlotDigit
                    target={numStr[0]}
                    duration={lotoConfig.value.roll_animation_time}
                    animationKey={lotoStore.isRolling ? lotoStore.displayNextNumber : null}
                    direction="up"
                    class="h-16 w-10 border-none shadow-none"
                  />
                  <SlotDigit
                    target={numStr[1]}
                    duration={lotoConfig.value.roll_animation_time}
                    animationKey={lotoStore.isRolling ? lotoStore.displayNextNumber : null}
                    direction="down"
                    class="h-16 w-10 border-none shadow-none"
                  />
                </div>
              </div>

              <div class="bg-card2">
                <Button
                  class="h-auto rounded-2xl px-8 py-8 text-xl font-black tracking-tighter uppercase shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                  onclick={() => lotoStore.rollNextNumber()}
                  disabled={lotoStore.drawPool.length === 0 || lotoStore.isRolling}
                >
                  Ролл
                </Button>
              </div>
            </div>
          </div>
        {/if}

        {#if lotoStore.drawnNumbers.length > 0}
          {@const fancyName =
            NumberToFancyName[lotoStore.drawnNumbers[lotoStore.drawnNumbers.length - 1]]}
          <div
            class="bg-card2 flex max-w-2xl flex-col gap-3 rounded-2xl border border-border/80 p-4 shadow-inner"
          >
            {#if fancyName}
              <div class="flex items-center justify-center px-2">
                <h2 class="text-lg font-semibold tracking-[0.3em] uppercase">{fancyName}</h2>
              </div>
            {/if}
            <div class="flex items-center justify-center px-2">
              <h2 class="text-xs font-black tracking-[0.3em] text-muted-foreground uppercase">
                Открыто {lotoStore.drawnNumbers.length}
              </h2>
            </div>
            <div class="flex flex-wrap justify-center gap-2">
              {#each lotoStore.drawnNumbers as num (num)}
                {@const isWinnerMatch = lotoStore.winnerMatchedNumbers.includes(num)}
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-lg border {isWinnerMatch
                    ? 'border-green-500/80 bg-green-500/40 text-green-500 shadow-lg shadow-green-500/40'
                    : 'border-primary/40 bg-background text-primary'} font-black shadow-sm"
                  in:fade={{ duration: 300 }}
                >
                  {num}
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="h-20"></div>
        {/if}
      {/if}

      <SuperGame />

      <div class="z-50 mb-50 ml-70 flex flex-wrap justify-center gap-4">
        {#each lotoStore.ticketsOrdered as ticket (ticket.id)}
          {@const user = lotoStore.usersById.get(ticket.owner_id)!}
          <div class="inline-grid gap-2" animate:flip={{ duration: 700 }} in:fade>
            <div class="col-start-1 row-start-1">
              <button
                class="cursor-pointer transition-transform hover:scale-105"
                onclick={() => {
                  if (lotoStore.openedChats.has(ticket.id)) {
                    lotoStore.openedChats.delete(ticket.id)
                  } else {
                    lotoStore.openedChats.add(ticket.id)
                  }
                }}
              >
                <LotoTicket
                  {ticket}
                  {user}
                  matchedNumbers={lotoStore.drawnNumbers}
                  lastRolledNumber={lotoStore.drawnNumbers[lotoStore.drawnNumbers.length - 1]}
                  winnerMatchedNumbers={lotoStore.winner?.id === ticket.id
                    ? lotoStore.winnerMatchedNumbers
                    : []}
                  showTimestamp={lotoStore.winnerCandidates.size > 1 &&
                    lotoStore.winnerCandidates.has(ticket.id)}
                />
              </button>
            </div>
            {#if lotoStore.openedChats.has(ticket.id)}
              <TicketPanel {ticket} canBan={isOwnerFor(ticket)} />
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes pulse-size {
    0%,
    100% {
      scale: 1;
    }
    50% {
      scale: 1.1;
    }
  }

  :global(.button-animate) {
    animation: pulse-size 1s ease-in-out infinite;
  }
</style>

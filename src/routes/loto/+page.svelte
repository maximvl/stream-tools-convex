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
  import { fetchVkRoles } from '$lib/api'
  import type { ChatServer } from '$lib/types'
  import { BackgroundImages } from '$lib/constants'

  import BgPattern5 from '$lib/components/common/BgPattern5.svelte'
  import { NumberToFancyName } from '$lib/components/loto/utils'
  import TicketPanel from '$lib/components/loto/TicketPanel.svelte'
  import { AuthStore } from '$lib/stores/authStore.svelte'
  import AuthDialog from '$lib/components/auth/AuthDialog.svelte'

  const lotoConfig = getLotoConfigStore()
  const lotoStore = new LotoStore(lotoConfig)
  setLotoStore(lotoStore)
  const store = getChatStore()
  const countdownTimer = new TimerStore()

  const authStore = new AuthStore()
  lotoStore.setAuthStore(authStore)

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
<div class="dark relative flex min-h-screen flex-col overflow-hidden p-6">
  <div class="fixed top-6 left-6 z-10 flex flex-col gap-4">
    <ConnectionDialog />
    <div class="bg-card2 w-fit rounded-lg">
      <LotoSettingsDialog />
    </div>
    <AuthDialog {authStore} />
    {#if lotoStore.gameState === 'registration'}
      <div class="bg-card2 flex flex-col gap-2 rounded-xl p-2">
        <div class="text-center">Таймер</div>
        <div class="flex flex-col gap-2">
          <Button
            class="h-auto rounded-xl bg-blue-600 px-4 py-2 text-sm font-black tracking-tighter uppercase shadow-lg transition-all hover:scale-105 hover:bg-blue-500 active:scale-95"
            onclick={() => addTime(60)}
          >
            +1 мин
          </Button>
          <Button
            class="h-auto rounded-xl bg-purple-600 px-4 py-2 text-sm font-black tracking-tighter uppercase shadow-lg transition-all hover:scale-105 hover:bg-purple-500 active:scale-95"
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
    {#if lotoStore.streamerTickets.length === 0}
      <div class="bg-card2 rounded-xl border border-primary/60 p-4 text-xl">
        Место билета стримера
      </div>
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
        <LotoWinnerBanner user={winnerUser} name={lotoStore.winner.owner_name} />
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
            <TicketPanel {ticket} />
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

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

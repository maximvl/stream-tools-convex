<script lang="ts">
  import { useConvexClient } from 'convex-svelte'
  import { cn } from '$lib/utils'
  import {
    MOVE_IMAGE,
    submitRpsMove,
    type BoardMatchView,
    type MatchId,
    type MyEntryView,
    type ParticipantId,
    type RpsMove,
  } from '$lib/rps'
  import Countdown from './Countdown.svelte'
  import MatchCard from './MatchCard.svelte'
  import PlayerCard from './PlayerCard.svelte'

  let {
    entry,
    matches,
    sessionId,
    tournamentRunning,
  }: {
    entry: MyEntryView
    matches: BoardMatchView[]
    sessionId: string
    tournamentRunning: boolean
  } = $props()

  const convex = useConvexClient()

  const current = $derived(matches.find((m) => m.status === 'pending') ?? null)
  // Latest resolved match stays on the arena in result mode until the next
  // round (or the end) — it doesn't collapse into history right away.
  const lastResolved = $derived(matches.find((m) => m.status === 'resolved') ?? null)
  const history = $derived(
    matches.filter((m) => m.status === 'resolved' && m.id !== lastResolved?.id),
  )
  const arena = $derived(current ?? lastResolved)
  const interactive = $derived(arena?.status === 'pending' && entry.status === 'active')

  let now = $state(Date.now())
  $effect(() => {
    const t = setInterval(() => {
      now = Date.now()
    }, 500)
    return () => clearInterval(t)
  })

  const closed = $derived(current !== null && now > current.deadline_at)
  const moves: RpsMove[] = ['rock', 'paper', 'scissors']

  let submitting = $state(false)
  let submitError = $state<string | null>(null)

  async function pick(move: RpsMove) {
    if (!current || current.my_move) return
    submitting = true
    submitError = null
    try {
      await submitRpsMove(convex, {
        match_id: current.id as MatchId,
        participant_id: entry.id as ParticipantId,
        move,
        viewer_session_id: sessionId,
      })
    } catch (e) {
      submitError = e instanceof Error ? e.message : 'Не вышло отправить ход'
    } finally {
      submitting = false
    }
  }
</script>

<div class="flex flex-col gap-4 rounded-3xl border bg-card p-6">
  <div class="flex items-center justify-between">
    <div>
      <span class="text-xl font-black">{entry.display_name}</span>
      <span class="ml-2 text-xs text-muted-foreground">
        {entry.platform} · через {entry.via_stream_channel} · {entry.wins} побед
      </span>
    </div>
    {#if entry.status === 'eliminated'}
      <span class="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400 uppercase">
        Вылет в раунде {entry.eliminated_in_round ?? '?'}
      </span>
    {:else if entry.status === 'champion'}
      <span
        class="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-bold text-yellow-400 uppercase"
      >
        Чемпион
      </span>
    {:else}
      <span
        class="rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold text-green-400 uppercase"
      >
        В игре
      </span>
    {/if}
  </div>

  {#if arena}
    {@const match = arena}
    {@const opp = match.opp}
    {@const myPick = match.my_move ?? null}
    {@const oppPick = match.status === 'resolved' ? (match.opp_move ?? null) : null}
    <div class="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div class="flex items-stretch justify-center gap-2 sm:gap-4">
        <!-- My side: info left, move buttons right of it -->
        <div class="flex flex-1 flex-col items-center justify-center gap-2">
          {#if match.me}
            <PlayerCard
              name={match.me.display_name}
              platform={match.me.platform}
              userSlug={match.me.user_slug}
              meta="Ты"
            />
          {/if}
        </div>
        <div class="flex flex-col justify-center gap-2">
          {#each moves as move (move)}
            {@const locked = !interactive || myPick !== null || submitting || closed}
            {@const isPicked = myPick === move}
            <button
              class={cn(
                'rounded-2xl border-2 p-1.5 transition-all',
                isPicked
                  ? 'scale-105 border-green-500 bg-green-500/15 shadow-lg shadow-green-500/30'
                  : 'border-transparent',
                !locked && 'cursor-pointer hover:scale-110 hover:border-primary/50 active:scale-95',
                locked && 'cursor-default',
                locked && !isPicked && 'opacity-40 grayscale',
              )}
              disabled={locked}
              onclick={() => pick(move)}
              title={move}
            >
              <img
                src={MOVE_IMAGE[move]}
                alt={move}
                class="h-12 w-12 object-contain sm:h-14 sm:w-14"
              />
            </button>
          {/each}
        </div>

        <!-- Center: timer / state / result -->
        <div class="flex w-20 shrink-0 flex-col items-center justify-center gap-1 text-center">
          {#if interactive}
            {#if myPick}
              <span class="text-xs text-muted-foreground">Ждём соперника…</span>
            {:else if closed}
              <span class="text-sm font-bold text-red-500">Время вышло</span>
            {:else}
              <span class="text-xs tracking-widest text-muted-foreground uppercase">Ходи</span>
              <Countdown deadline_at={match.deadline_at} />
            {/if}
          {:else}
            <span
              class="text-sm font-bold {match.is_draw
                ? 'text-amber-300'
                : match.i_won
                  ? 'text-green-400'
                  : 'text-red-400'}"
            >
              {match.is_draw ? 'Ничья' : match.i_won ? 'Победа' : 'Поражение'}
            </span>
          {/if}
        </div>

        <!-- Opponent side: mirrored — muted icons left of info, pick lights
             up once the match resolves -->
        <div class="flex flex-col justify-center gap-2">
          {#each moves as move (move)}
            {@const isOppPick = oppPick === move}
            <div
              class={cn(
                'rounded-2xl border-2 p-1.5',
                isOppPick
                  ? 'scale-105 border-amber-400 bg-amber-400/15 shadow-lg shadow-amber-400/30'
                  : 'border-transparent opacity-30 grayscale',
              )}
              title={move}
            >
              <img
                src={MOVE_IMAGE[move]}
                alt={move}
                class="h-12 w-12 object-contain sm:h-14 sm:w-14"
              />
            </div>
          {/each}
        </div>
        <div class="flex flex-1 flex-col items-center justify-center gap-2">
          {#if opp}
            <PlayerCard
              name={opp.is_bot ? 'BOT' : opp.display_name}
              platform={opp.platform}
              userSlug={opp.is_bot ? undefined : opp.user_slug}
              meta={opp.is_bot ? 'бот' : `${opp.wins} побед`}
            />
          {/if}
          {#if interactive && current}
            {#if current.opp_moved}
              <span class="text-xs font-bold text-green-400">Ход сделан ✓</span>
            {:else}
              <span class="animate-pulse text-xs text-muted-foreground">Ждёт ход…</span>
            {/if}
          {/if}
        </div>
      </div>
      {#if submitError}
        <p class="mt-2 text-center text-sm text-red-500">{submitError}</p>
      {/if}
    </div>
  {:else if entry.status === 'active' && tournamentRunning}
    <div class="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
      <p class="text-sm text-muted-foreground">Бой выигран! Ждём, пока доиграют другие пары…</p>
    </div>
  {/if}

  {#if history.length > 0}
    <div class="flex flex-col gap-1.5">
      <p class="text-sm font-bold tracking-widest text-muted-foreground uppercase">История</p>
      {#each history as h (h.id as string)}
        {@const winnerId = h.is_draw ? undefined : h.i_won ? h.me?.id : h.opp?.id}
        {#if h.me && h.opp}
          <MatchCard
            match={{
              id: h.id,
              round: h.round,
              status: 'resolved',
              winner_id: winnerId,
              is_draw: h.is_draw,
              move_a: h.my_move,
              move_b: h.opp_move,
              move_a_set: h.my_move !== undefined,
              move_b_set: h.opp_move !== undefined,
              deadline_at: h.deadline_at,
              a: h.me,
              b: h.opp,
            }}
          />
        {/if}
      {/each}
    </div>
  {/if}
</div>

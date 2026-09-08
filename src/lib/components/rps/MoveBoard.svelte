<script lang="ts">
  import { useConvexClient } from 'convex-svelte'
  import { Button } from '$lib/components/ui/button'
  import {
    MOVE_GLYPH,
    submitRpsMove,
    type BoardMatchView,
    type MatchId,
    type MyEntryView,
    type ParticipantId,
    type RpsMove,
  } from '$lib/rps'
  import Countdown from './Countdown.svelte'

  let {
    entry,
    matches,
    sessionId,
  }: {
    entry: MyEntryView
    matches: BoardMatchView[]
    sessionId: string
  } = $props()

  const convex = useConvexClient()

  const current = $derived(matches.find((m) => m.status === 'pending') ?? null)
  const history = $derived(matches.filter((m) => m.status === 'resolved'))

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

  {#if current && entry.status === 'active'}
    {@const opp = current.opp}
    <div class="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
      <p class="text-sm text-muted-foreground">Текущий соперник</p>
      <p class="text-2xl font-black">{opp?.is_bot ? 'BOT 🤖' : (opp?.display_name ?? '—')}</p>
      {#if current.my_move}
        <p class="mt-2 text-lg">
          Твой ход: {MOVE_GLYPH[current.my_move]} · ждём соперника…
        </p>
      {:else if closed}
        <p class="mt-2 font-bold text-red-500">Время вышло</p>
      {:else}
        <div class="mt-2 flex items-center justify-center gap-2">
          <span class="text-sm text-muted-foreground">Ходи!</span>
          <Countdown deadline_at={current.deadline_at} />
        </div>
        <div class="mt-3 flex justify-center gap-3">
          {#each moves as move (move)}
            <Button
              class="h-20 w-20 rounded-2xl text-4xl transition-all hover:scale-110 active:scale-95 disabled:opacity-40"
              disabled={submitting}
              onclick={() => pick(move)}
            >
              {MOVE_GLYPH[move]}
            </Button>
          {/each}
        </div>
      {/if}
      {#if submitError}
        <p class="mt-2 text-sm text-red-500">{submitError}</p>
      {/if}
    </div>
  {/if}

  {#if history.length > 0}
    <div class="flex flex-col gap-1.5">
      <p class="text-sm font-bold tracking-widest text-muted-foreground uppercase">История</p>
      {#each history as h (h.id as string)}
        <div class="bg-card2 flex items-center justify-between rounded-xl px-3 py-2 text-sm">
          <span class="text-muted-foreground">Раунд {h.round} · {h.opp?.display_name}</span>
          <span>
            {#if h.my_move}{MOVE_GLYPH[h.my_move]}{/if}
            :
            {#if h.opp_move}{MOVE_GLYPH[h.opp_move]}{/if}
          </span>
          <span
            class="font-bold {h.is_draw
              ? 'text-amber-300'
              : h.i_won
                ? 'text-green-400'
                : 'text-red-400'}"
          >
            {h.is_draw ? 'Ничья' : h.i_won ? 'Победа' : 'Поражение'}
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

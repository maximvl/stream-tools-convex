<script lang="ts">
  import { MOVE_GLYPH, type RoundMatchView } from '$lib/rps'
  import Countdown from './Countdown.svelte'

  let { match }: { match: RoundMatchView } = $props()

  const winnerSide = $derived(
    match.winner_id === undefined
      ? null
      : match.winner_id === match.a?.id
        ? 'a'
        : match.winner_id === match.b?.id
          ? 'b'
          : null,
  )
</script>

<div class="flex items-center gap-3 rounded-2xl border bg-card p-4">
  <div
    class="flex flex-1 flex-col items-center gap-1 rounded-xl p-2 {winnerSide === 'a'
      ? 'bg-green-500/15 ring-1 ring-green-500/50'
      : ''}"
  >
    <span class="font-bold">{match.a?.display_name ?? '—'}</span>
    <span class="text-xs text-muted-foreground">
      {match.a?.is_bot ? 'BOT' : match.a?.platform} · {match.a?.wins ?? 0} побед
    </span>
    {#if match.status === 'resolved' && match.move_a}
      <span class="text-3xl">{MOVE_GLYPH[match.move_a]}</span>
    {/if}
  </div>

  <div class="flex w-20 flex-col items-center gap-1 text-center">
    {#if match.status === 'pending'}
      <span class="text-xs tracking-widest text-muted-foreground uppercase">Бой</span>
      <Countdown deadline_at={match.deadline_at} />
    {:else if match.is_draw}
      <span class="text-sm font-bold text-amber-300">Ничья</span>
      <span class="text-xs text-muted-foreground">переигровка</span>
    {:else}
      <span class="text-sm font-bold text-green-400">Победитель</span>
    {/if}
  </div>

  <div
    class="flex flex-1 flex-col items-center gap-1 rounded-xl p-2 {winnerSide === 'b'
      ? 'bg-green-500/15 ring-1 ring-green-500/50'
      : ''}"
  >
    <span class="font-bold">{match.b?.display_name ?? '—'}</span>
    <span class="text-xs text-muted-foreground">
      {match.b?.is_bot ? 'BOT' : match.b?.platform} · {match.b?.wins ?? 0} побед
    </span>
    {#if match.status === 'resolved' && match.move_b}
      <span class="text-3xl">{MOVE_GLYPH[match.move_b]}</span>
    {/if}
  </div>
</div>

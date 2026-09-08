<script lang="ts">
  import { MOVE_IMAGE, type RoundMatchView } from '$lib/rps'
  import Countdown from './Countdown.svelte'
  import PlayerCard from './PlayerCard.svelte'

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
  const resolved = $derived(match.status === 'resolved')
</script>

<div class="flex items-center gap-3 rounded-2xl border bg-card p-4">
  <div
    class="flex flex-1 flex-col items-center gap-1 rounded-xl p-2 {winnerSide === 'a'
      ? 'bg-green-500/15 ring-1 ring-green-500/50'
      : ''}"
  >
    {#if match.a}
      <PlayerCard
        name={match.a.display_name}
        platform={match.a.platform}
        userSlug={match.a.user_slug}
        meta={`${match.a.wins} побед`}
        dim={resolved && winnerSide !== null && winnerSide !== 'a'}
      />
      {#if !resolved}
        {#if match.move_a_set}
          <span class="text-xs font-bold text-green-400">Ход сделан ✓</span>
        {:else}
          <span class="animate-pulse text-xs text-muted-foreground">Думает…</span>
        {/if}
      {/if}
    {/if}
  </div>

  {#if resolved && match.move_a}
    <img src={MOVE_IMAGE[match.move_a]} alt={match.move_a} class="h-12 w-12 object-contain" />
  {/if}

  {#if match.status === 'pending'}
    <div class="flex w-20 flex-col items-center gap-1 text-center">
      <span class="text-xs tracking-widest text-muted-foreground uppercase">Бой</span>
      <Countdown deadline_at={match.deadline_at} />
    </div>
  {:else if match.is_draw}
    <div class="flex w-20 flex-col items-center gap-1 text-center">
      <span class="text-sm font-bold text-amber-300">Ничья</span>
      <span class="text-xs text-muted-foreground">переигровка</span>
    </div>
  {/if}

  {#if resolved && match.move_b}
    <img
      src={MOVE_IMAGE[match.move_b]}
      alt={match.move_b}
      class="h-12 w-12 scale-x-[-1] object-contain"
    />
  {/if}

  <div
    class="flex flex-1 flex-col items-center gap-1 rounded-xl p-2 {winnerSide === 'b'
      ? 'bg-green-500/15 ring-1 ring-green-500/50'
      : ''}"
  >
    {#if match.b}
      <PlayerCard
        name={match.b.display_name}
        platform={match.b.platform}
        userSlug={match.b.user_slug}
        meta={`${match.b.wins} побед`}
        dim={resolved && winnerSide !== null && winnerSide !== 'b'}
      />
      {#if !resolved}
        {#if match.move_b_set}
          <span class="text-xs font-bold text-green-400">Ход сделан ✓</span>
        {:else}
          <span class="animate-pulse text-xs text-muted-foreground">Думает…</span>
        {/if}
      {/if}
    {/if}
  </div>
</div>

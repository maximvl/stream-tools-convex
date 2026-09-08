<script lang="ts">
  import { useQuery } from 'convex-svelte'
  import { api } from '../../../../convex/_generated/api.js'
  import type { TournamentId } from '$lib/rps'
  import MatchCard from './MatchCard.svelte'

  let { tournamentId, round }: { tournamentId: TournamentId; round: number } = $props()

  const matches = useQuery(api.rpsMatches.matchesForRound, () => ({
    tournament_id: tournamentId,
    round,
  }))

  const items = $derived(matches.data ?? [])
</script>

<div class="flex flex-col gap-3">
  <h3 class="text-lg font-bold">Раунд {round}</h3>
  {#if matches.isLoading}
    <p class="text-sm text-muted-foreground">Загрузка…</p>
  {:else if items.length === 0}
    <p class="text-sm text-muted-foreground">Матчей пока нет.</p>
  {:else}
    {#each items as m (m.id as string)}
      <MatchCard match={m} />
    {/each}
  {/if}
</div>

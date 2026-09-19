<script lang="ts">
  import type { Item, RoundType } from '$lib/turnir/types'
  import RandomEliminationRound from './RandomEliminationRound.svelte'
  import StreamerChoiceRound from './StreamerChoiceRound.svelte'
  import ViewerChoiceRound from './ViewerChoiceRound.svelte'

  type Props = {
    roundType: RoundType
    activeItems: Item[]
    onItemElimination: (id: string) => void
    subscriberOnly: boolean
  }

  let { roundType, activeItems, onItemElimination, subscriberOnly }: Props = $props()
</script>

{#if roundType === 'RandomElimination'}
  <RandomEliminationRound items={activeItems} onItemWinning={onItemElimination} />
{:else if roundType === 'StreamerChoice'}
  <StreamerChoiceRound items={activeItems} {onItemElimination} />
{:else if roundType === 'ViewerChoice'}
  <ViewerChoiceRound items={activeItems} {onItemElimination} {subscriberOnly} />
{/if}

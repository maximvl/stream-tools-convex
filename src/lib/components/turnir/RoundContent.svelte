<script lang="ts">
  import type { Item, RoundType } from '$lib/turnir/types'
  import ProtectionRound from './ProtectionRound.svelte'
  import RandomEliminationRound from './RandomEliminationRound.svelte'
  import StreamerChoiceRound from './StreamerChoiceRound.svelte'
  import SwapRound from './SwapRound.svelte'
  import ViewerChoiceRound from './ViewerChoiceRound.svelte'

  type Props = {
    roundType: RoundType
    activeItems: Item[]
    onItemElimination: (id: string) => void
    onItemProtection: (id: string) => void
    onItemSwap: (id: string) => void
    subscriberOnly: boolean
  }

  let {
    roundType,
    activeItems,
    onItemElimination,
    onItemProtection,
    onItemSwap,
    subscriberOnly,
  }: Props = $props()
</script>

{#if roundType === 'RandomElimination'}
  <RandomEliminationRound items={activeItems} onItemWinning={onItemElimination} />
{:else if roundType === 'StreamerChoice'}
  <StreamerChoiceRound items={activeItems} {onItemElimination} />
{:else if roundType === 'ViewerChoice'}
  <ViewerChoiceRound items={activeItems} {onItemElimination} {subscriberOnly} />
{:else if roundType === 'Protection'}
  <ProtectionRound items={activeItems} {onItemProtection} />
{:else if roundType === 'Swap'}
  <SwapRound items={activeItems} {onItemSwap} />
{/if}

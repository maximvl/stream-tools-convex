<script lang="ts">
  import { RoundTypeNames, type RoundType } from '$lib/turnir/types'

  type Props = {
    roundNumber: number
    roundType: RoundType
    itemsLeft: number
  }

  let { roundNumber, roundType, itemsLeft }: Props = $props()

  let isFinals = $derived(itemsLeft === 2)
</script>

<div>
  {#if isFinals}
    <h1 class="mt-0 text-3xl font-extrabold">Финал</h1>
    <p class="text-muted-foreground">{RoundTypeNames[roundType]}</p>
  {:else}
    <h3 class="mt-0 text-xl font-bold">
      Раунд {roundNumber}: {RoundTypeNames[roundType]}
    </h3>
  {/if}
</div>

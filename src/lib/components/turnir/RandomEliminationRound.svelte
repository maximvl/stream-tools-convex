<script lang="ts">
  import type { Item } from '$lib/turnir/types'
  import Wheel from './Wheel.svelte'

  type Props = {
    items: Item[]
    onItemWinning: (id: string) => void
  }

  let { items, onItemWinning }: Props = $props()
</script>

<Wheel {items} {onItemWinning} />

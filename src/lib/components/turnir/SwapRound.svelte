<script lang="ts">
  import type { Item } from '$lib/turnir/types'
  import InfoPanel from './InfoPanel.svelte'
  import Wheel from './Wheel.svelte'

  type Props = {
    items: Item[]
    onItemSwap: (id: string) => void
  }

  let { items, onItemSwap }: Props = $props()
</script>

<div class="flex flex-col items-center">
  <InfoPanel>
    <p class="whitespace-pre-wrap">
      Случайный вариант секретно меняется с другим {'\n'}Подмена вскроется когда один из них вылетит
    </p>
  </InfoPanel>
  <div class="mt-4">
    <Wheel {items} onItemWinning={onItemSwap} confirmLabel="Подменить" confirmVariant="secondary" />
  </div>
</div>

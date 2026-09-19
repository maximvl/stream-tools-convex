<script lang="ts">
  import type { Item } from '$lib/turnir/types'
  import InfoPanel from './InfoPanel.svelte'
  import Wheel from './Wheel.svelte'

  type Props = {
    items: Item[]
    onItemProtection: (id: string) => void
  }

  let { items, onItemProtection }: Props = $props()
</script>

<div class="flex flex-col items-center">
  <InfoPanel>
    <p>Случайный вариант получит одноразовую защиту от вылета</p>
  </InfoPanel>
  <div class="mt-2">
    <Wheel
      {items}
      onItemWinning={onItemProtection}
      confirmLabel="Защитить"
      confirmVariant="default"
    />
  </div>
</div>

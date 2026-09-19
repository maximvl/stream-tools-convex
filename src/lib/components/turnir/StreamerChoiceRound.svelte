<script lang="ts">
  import { getMusicStore } from '$lib/stores/musicStore.svelte'
  import type { Item } from '$lib/turnir/types'
  import SelectItem from './SelectItem.svelte'
  import InfoPanel from './InfoPanel.svelte'

  type Props = {
    items: Item[]
    onItemElimination: (id: string) => void
  }

  let { items, onItemElimination }: Props = $props()

  const musicStore = getMusicStore()

  $effect(() => {
    musicStore.play(Math.random() >= 0.5 ? 'thinking' : 'light')
    return () => musicStore.stop()
  })
</script>

<div class="flex flex-col items-center">
  <InfoPanel>Стример выбирает кто вылетит</InfoPanel>
  <div class="mt-4 flex w-fit flex-col gap-4 text-left">
    {#each items as item (item.id)}
      <SelectItem {item} selected={false} highlightOnHover onItemClick={onItemElimination} />
    {/each}
  </div>
</div>

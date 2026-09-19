<script lang="ts">
  import type { Item } from '$lib/turnir/types'
  import SelectItem from './SelectItem.svelte'
  import InfoPanel from './InfoPanel.svelte'

  type Props = {
    items: Item[]
    onItemElimination: (id: string) => void
  }

  let { items, onItemElimination }: Props = $props()
</script>

<div class="flex flex-col items-center">
  <InfoPanel>Стример выбирает кто вылетит — нажмите на вариант</InfoPanel>
  <div class="mt-2 flex w-fit flex-col gap-4 text-left">
    {#each items as item (item.id)}
      <SelectItem {item} selected={false} highlightOnHover onItemClick={onItemElimination} />
    {/each}
  </div>
</div>

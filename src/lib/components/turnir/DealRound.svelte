<script lang="ts">
  import type { Item } from '$lib/turnir/types'
  import InfoPanel from './InfoPanel.svelte'
  import SelectItem from './SelectItem.svelte'

  type Props = {
    items: Item[]
    onItemDeal: (id: string) => void
  }

  let { items, onItemDeal }: Props = $props()

  let skipRounds = $derived(Math.round(items.length / 2))
</script>

<div class="flex flex-col items-center">
  <InfoPanel>
    <p>
      Выбери вариант, он пропускает половину турнира ({skipRounds} раундов)
      <br />
      Но ему придется ролить 50/50 чтобы вернуться в турнир
    </p>
  </InfoPanel>
  <div class="mt-4 flex w-fit flex-col gap-4 text-left">
    {#each items as item (item.id)}
      <SelectItem {item} selected={false} highlightOnHover onItemClick={onItemDeal} />
    {/each}
  </div>
</div>

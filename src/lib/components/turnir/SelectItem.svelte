<script lang="ts">
  import { cn } from '$lib/utils.js'
  import type { Item } from '$lib/turnir/types'
  import ItemTitle from './ItemTitle.svelte'

  type Props = {
    item: Item
    selected: boolean
    onItemClick: (id: string) => void
    highlightOnHover?: boolean
  }

  let { item, selected, onItemClick, highlightOnHover = false }: Props = $props()

  let isHovered = $state(false)
  let highlight = $derived(highlightOnHover ? isHovered || selected : selected)
</script>

<button
  type="button"
  class={cn(
    'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
    highlight
      ? 'border-red-400 bg-red-400/90 text-white'
      : 'bg-card hover:border-primary/50 hover:bg-accent',
  )}
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
  onclick={() => {
    if (selected) onItemClick(item.id)
    else if (highlightOnHover) onItemClick(item.id)
  }}
>
  <span class={cn('text-xl font-bold', highlight ? 'text-white' : 'text-orange-500')}>
    {item.id}
  </span>
  <span class={cn('h-5 w-px', highlight ? 'bg-white' : 'bg-muted-foreground/50')}></span>
  <ItemTitle {item} />
</button>

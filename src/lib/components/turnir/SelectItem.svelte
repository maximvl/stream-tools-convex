<script lang="ts">
  import { cn } from '$lib/utils.js'
  import type { Item } from '$lib/turnir/types'
  import ItemTitle from './ItemTitle.svelte'

  type Props = {
    item: Item
    selected: boolean
    onItemClick: (id: string) => void
    highlightOnHover?: boolean
    /** 0-100 background fill showing vote share */
    fillPct?: number
    fullWidth?: boolean
  }

  let {
    item,
    selected,
    onItemClick,
    highlightOnHover = false,
    fillPct = 0,
    fullWidth = false,
  }: Props = $props()

  let isHovered = $state(false)
  let highlight = $derived(highlightOnHover ? isHovered || selected : selected)
</script>

<button
  type="button"
  class={cn(
    'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
    'relative overflow-hidden',
    fullWidth && 'w-full',
    highlight
      ? 'border-red-500/60 bg-red-500/25 text-red-100'
      : 'bg-card hover:border-primary/50 hover:bg-accent',
  )}
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
  onclick={() => {
    if (selected) onItemClick(item.id)
    else if (highlightOnHover) onItemClick(item.id)
  }}
>
  {#if fillPct > 0}
    <span
      aria-hidden="true"
      class={cn(
        'absolute inset-y-0 left-0 transition-all',
        highlight ? 'bg-red-400/30' : 'bg-primary/25',
      )}
      style:width={`${fillPct}%`}
    ></span>
  {/if}
  <span class="relative flex items-center gap-2">
    <span class={cn('text-xl font-bold', highlight ? 'text-red-200' : 'text-orange-500')}>
      {item.id}
    </span>
    <span class={cn('h-5 w-px', highlight ? 'bg-red-200/60' : 'bg-muted-foreground/50')}></span>
    <ItemTitle {item} />
  </span>
</button>

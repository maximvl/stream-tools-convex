<script lang="ts">
  import { HeartPlus } from '@lucide/svelte'
  import { cn } from '$lib/utils.js'
  import type { Item } from '$lib/turnir/types'

  type Props = {
    item: Item
    fontSize?: string
    truncate?: boolean
  }

  let { item, fontSize = '18px', truncate = false }: Props = $props()
</script>

<span
  class={cn('inline-flex items-center', truncate && 'max-w-full min-w-0')}
  style:font-size={fontSize}
  title={truncate ? item.title : undefined}
>
  {#if item.isProtected}
    <span class="mr-1 shrink-0 text-green-500" title="Защищён">🛡</span>
  {/if}
  {#if item.swappedWith}
    <span class="mr-1 shrink-0 text-amber-500" title="Подменён">⇄</span>
  {/if}
  {#if item.isResurrected}
    <span class="mr-1 inline-flex shrink-0 text-white" title="Воскрешён">
      <HeartPlus class="h-[1em] w-[1em]" />
    </span>
  {/if}
  {#if item.hasDeal}
    <span class="mr-1 shrink-0 text-muted-foreground" title="Счастливый билетик">🎲</span>
  {/if}
  <span class={cn(truncate && 'truncate')}>{item.title}</span>
</span>

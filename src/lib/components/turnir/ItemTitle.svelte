<script lang="ts">
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
  <span class={cn(truncate && 'truncate')}>{item.title}</span>
  {#if item.isProtected}
    <span class="ml-1 shrink-0 text-green-500" title="Защищён">🛡</span>
  {/if}
  {#if item.swappedWith}
    <span class="ml-1 shrink-0 text-amber-500" title="Подменён">⇄</span>
  {/if}
  {#if item.isResurrected}
    <span class="ml-1 shrink-0 text-white" title="Воскрешён">✚</span>
  {/if}
  {#if item.hasDeal}
    <span class="ml-1 shrink-0 text-muted-foreground" title="Счастливый билетик">🎲</span>
  {/if}
</span>

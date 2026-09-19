<script lang="ts">
  import type { Item } from '$lib/turnir/types'

  type Props = {
    item: Item
    fontSize?: string
  }

  let { item, fontSize = '18px' }: Props = $props()
</script>

<span class="inline-flex items-center" style:font-size={fontSize}>
  {item.title}
  {#if item.isProtected}
    <span class="ml-1 text-green-500" title="Защищён">🛡</span>
  {/if}
  {#if item.swappedWith}
    <span class="ml-1 text-amber-500" title="Подменён">⇄</span>
  {/if}
  {#if item.isResurrected}
    <span class="ml-1 text-white" title="Воскрешён">✚</span>
  {/if}
  {#if item.hasDeal}
    <span class="ml-1 text-muted-foreground" title="Счастливый билетик">🎲</span>
  {/if}
</span>

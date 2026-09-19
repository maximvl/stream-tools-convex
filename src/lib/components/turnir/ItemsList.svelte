<script lang="ts">
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
  import { ExternalLink } from '@lucide/svelte'
  import type { Item } from '$lib/turnir/types'
  import ItemTitle from './ItemTitle.svelte'

  type Props = {
    items: Item[]
    activeItems: Item[]
    canEditItems: boolean
    setItemTitle: (index: number, text: string) => void
    pasteItems: (index: number, lines: string[]) => void
    showKPLinks?: boolean
  }

  let {
    items,
    activeItems,
    canEditItems,
    setItemTitle,
    pasteItems,
    showKPLinks = true,
  }: Props = $props()

  let editableCount = $derived(items.filter((item) => item.title.trim() !== '').length)
  let playActive = $derived(activeItems.filter((item) => item.status !== 'Eliminated'))
  let playEliminated = $derived(activeItems.filter((item) => item.status === 'Eliminated'))

  function handlePaste(e: ClipboardEvent, index: number) {
    const text = e.clipboardData?.getData('text')
    if (!text) return
    e.preventDefault()
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
    if (lines.length > 0) pasteItems(index, lines)
  }

  function kpQuery(title: string) {
    return title.split('-')[0].trim()
  }
</script>

<div>
  {#if canEditItems}
    <h3 class="mt-0 text-lg font-bold">Участники ({editableCount})</h3>
    <p class="pb-1 text-sm text-muted-foreground">можно вставлять несколько строк</p>
    <div class="flex flex-col items-start gap-2">
      {#each items as item, index (item.id)}
        <div class="flex w-full items-center gap-2">
          <div class="flex flex-1 items-center gap-2 pr-2">
            <span class="text-sm text-muted-foreground">{index + 1}.</span>
            <Input
              type="text"
              value={item.title}
              oninput={(e) => setItemTitle(index, e.currentTarget.value)}
              onpaste={(e) => handlePaste(e, index)}
            />
          </div>
          {#if showKPLinks && item.title}
            <a
              href={`https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(kpQuery(item.title))}`}
              target="_blank"
              rel="noopener noreferrer"
              tabindex={-1}
              title="Найти на Кинопоиске"
            >
              <Button variant="outline" size="sm" tabindex={-1}>
                КП <ExternalLink />
              </Button>
            </a>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <h3 class="mt-0 text-lg font-bold">Участники ({playActive.length})</h3>
    <div class="flex flex-col items-start gap-2">
      {#each playActive as item (item.id)}
        <div class="flex w-full items-center gap-2">
          <div class="flex min-w-0 flex-1 items-center gap-2 pr-2">
            <span class="shrink-0 text-sm text-muted-foreground">{item.id}.</span>
            <span class="min-w-0 flex-1 text-green-500"><ItemTitle {item} truncate /></span>
          </div>
          {#if showKPLinks && item.title}
            <a
              class="shrink-0"
              href={`https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(kpQuery(item.title))}`}
              target="_blank"
              rel="noopener noreferrer"
              tabindex={-1}
              title="Найти на Кинопоиске"
            >
              <Button variant="outline" size="sm" tabindex={-1}>
                КП <ExternalLink />
              </Button>
            </a>
          {/if}
        </div>
      {/each}
      <h3 class="mt-2 text-lg font-bold">Выбывшие ({playEliminated.length})</h3>
      {#each playEliminated as item (item.id)}
        <div class="flex w-full items-center gap-2">
          <div class="flex min-w-0 flex-1 items-center gap-2 pr-2">
            <span class="shrink-0 text-sm text-muted-foreground">{item.id}.</span>
            <span class="min-w-0 flex-1 truncate text-red-400" title={item.title}>
              {item.title}
            </span>
          </div>
          {#if showKPLinks && item.title}
            <a
              class="shrink-0"
              href={`https://www.kinopoisk.ru/index.php?kp_query=${encodeURIComponent(kpQuery(item.title))}`}
              target="_blank"
              rel="noopener noreferrer"
              tabindex={-1}
              title="Найти на Кинопоиске"
            >
              <Button variant="outline" size="sm" tabindex={-1}>
                КП <ExternalLink />
              </Button>
            </a>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

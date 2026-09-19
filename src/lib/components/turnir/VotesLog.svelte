<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import type { ChatMessageWithSource } from '$lib/types'
  import type { Item } from '$lib/turnir/types'

  type Props = {
    votes: ChatMessageWithSource[]
    items: Item[]
    isFinished: boolean
  }

  let { votes, items, isFinished }: Props = $props()

  let showLogs = $state(true)
  let scrollable: HTMLDivElement | null = $state(null)

  let itemNameMap = $derived.by(() => {
    const map: Record<string, string> = {}
    for (const item of items) map[item.id] = item.title
    return map
  })

  function formatTime(timestampMs: number) {
    const date = new Date(timestampMs)
    const pad = (n: number) => (n < 10 ? `0${n}` : n)
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  $effect(() => {
    votes.length
    isFinished
    scrollable?.scrollTo({ top: scrollable.scrollHeight })
  })
</script>

<div>
  Лог голосования
  <Button variant="outline" class="ml-2" onclick={() => (showLogs = !showLogs)}>
    {showLogs ? 'Скрыть логи' : 'Показать логи'}
  </Button>
  {#if showLogs}
    <div bind:this={scrollable} class="m-1 h-75 overflow-scroll rounded-lg border">
      {#each votes as vote (vote.id)}
        <span class="m-1 block text-left text-sm">
          {formatTime(vote.timestampMs)}: {vote.user.displayName} голосует против {vote.text.trim()}
          ({itemNameMap[vote.text.trim()] ?? '?'})
        </span>
      {/each}
      {#if isFinished}
        <span class="m-1 block text-center text-sm">Голосование завершено</span>
      {/if}
    </div>
  {/if}
</div>

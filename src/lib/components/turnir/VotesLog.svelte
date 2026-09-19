<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import type { ChatMessageWithSource } from '$lib/types'
  import type { Item } from '$lib/turnir/types'

  type Props = {
    votes: ChatMessageWithSource[]
    items: Item[]
    isFinished: boolean
    hideVotes?: boolean
    /** Preposition in "голосует <verb> <id>": 'против' (elimination) or 'за' (resurrection). Empty = none. */
    voteVerb?: string
  }

  let { votes, items, isFinished, hideVotes = false, voteVerb = 'против' }: Props = $props()

  // hideVotes is a static mount-time flag (hidden voting phases), never toggled later.
  // svelte-ignore state_referenced_locally -- intentionally capturing the initial value
  let showLogs = $state(!hideVotes)
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
    <div
      bind:this={scrollable}
      class="m-1 mx-auto h-75 w-[480px] max-w-full overflow-scroll rounded-lg border px-2"
    >
      {#each votes as vote (vote.id)}
        {@const optionId = vote.text.trim()}
        <span class="m-1 block text-left text-sm">
          {formatTime(vote.timestampMs)}: {vote.user.displayName} голосует{voteVerb
            ? ` ${voteVerb}`
            : ''}
          {optionId} ({itemNameMap[optionId] ?? '?'})
        </span>
      {/each}
      {#if isFinished}
        <span class="m-1 block text-center text-sm">Голосование завершено</span>
      {/if}
    </div>
  {/if}
</div>

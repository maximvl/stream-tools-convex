<script lang="ts">
  import type { Item } from '$lib/turnir/types'
  import SelectItem from './SelectItem.svelte'
  import InfoPanel from './InfoPanel.svelte'

  type Props = {
    items: Item[]
    votes: string[]
    onItemElimination?: (id: string) => void
    time?: number
    showInfo?: boolean
  }

  let { items, votes, onItemElimination, time, showInfo = true }: Props = $props()

  let timePassed = $derived.by(() => {
    if (time === undefined) return ''
    const seconds = time % 60
    const minutes = Math.floor(time / 60)
    const ss = seconds < 10 ? `0${seconds}` : `${seconds}`
    const mm = minutes < 10 ? `0${minutes}` : `${minutes}`
    return `${mm}:${ss}`
  })

  let votesByOption = $derived.by(() => {
    const counts: Record<string, number> = {}
    for (const item of items) counts[item.id] = 0
    for (const option of votes) {
      if (option in counts) counts[option] += 1
    }
    return counts
  })

  let totalVotes = $derived(votes.length)

  let winningIds = $derived.by(() => {
    const values = Object.values(votesByOption)
    if (values.length === 0) return [] as string[]
    const max = Math.max(...values)
    if (max === 0) return [] as string[]
    return Object.keys(votesByOption).filter((id) => votesByOption[id] === max)
  })
</script>

<div>
  <div class="grid justify-center text-center">
    <h2 class="m-0 text-xl font-bold">
      Результаты голосования ({totalVotes})
      {timePassed}
    </h2>
    {#if showInfo}
      <InfoPanel>
        <p class="whitespace-pre-wrap">
          Голосуйте номером варианта в чате: '5' а не '555' или '5 5 5' и тд {'\n'}<u
            >МОЖНО МЕНЯТЬ ГОЛОС</u
          >, засчитывается самый последний
        </p>
      </InfoPanel>
    {/if}
  </div>
  <div class="mt-2 flex justify-center">
    <div class="flex w-fit flex-col">
      {#each items as item (item.id)}
        {@const highlight = totalVotes > 0 && winningIds.includes(item.id)}
        <div class="mb-2.5 text-right">
          <SelectItem
            {item}
            selected={highlight}
            onItemClick={(id: string) => onItemElimination?.(id)}
          />
        </div>
      {/each}
    </div>
    <div class="ml-4 flex w-50 flex-col">
      {#each items as item (item.id)}
        {@const highlight = totalVotes > 0 && winningIds.includes(item.id)}
        {@const currentVotes = votesByOption[item.id] ?? 0}
        {@const pct = totalVotes > 0 ? (currentVotes / totalVotes) * 100 : 0}
        <div class="mb-2.5 grid h-8 w-50 items-center">
          <div class="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full transition-all {highlight ? 'bg-red-400' : 'bg-primary'}"
              style:width={`${pct}%`}
            ></div>
          </div>
        </div>
      {/each}
    </div>
    <div class="ml-2.5 flex flex-col self-end">
      {#each items as item (item.id)}
        {@const currentVotes = votesByOption[item.id] ?? 0}
        <div class="mb-2.5 grid h-8 content-center text-lg">
          {currentVotes}
        </div>
      {/each}
    </div>
  </div>
</div>

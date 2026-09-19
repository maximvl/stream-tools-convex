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
  <div class="mt-4 flex justify-center">
    <div
      class="grid w-full max-w-2xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5"
    >
      {#each items as item (item.id)}
        {@const highlight = totalVotes > 0 && winningIds.includes(item.id)}
        {@const currentVotes = votesByOption[item.id] ?? 0}
        {@const pct = totalVotes > 0 ? (currentVotes / totalVotes) * 100 : 0}
        <SelectItem
          {item}
          selected={highlight}
          fillPct={pct}
          fullWidth
          onItemClick={(id: string) => onItemElimination?.(id)}
        />
        <div class="text-lg leading-none">
          {currentVotes}
        </div>
      {/each}
    </div>
  </div>
</div>

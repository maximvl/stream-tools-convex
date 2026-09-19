<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { getChatStore } from '$lib/context'
  import { getMusicStore } from '$lib/stores/musicStore.svelte'
  import { TurnirVoting } from '$lib/stores/turnirVoting.svelte'
  import type { Item } from '$lib/turnir/types'
  import { untrack } from 'svelte'
  import InfoPanel from './InfoPanel.svelte'
  import PollResults from './PollResults.svelte'
  import SelectItem from './SelectItem.svelte'
  import VotesLog from './VotesLog.svelte'

  type Props = {
    items: Item[]
    onItemElimination: (id: string) => void
    subscriberOnly: boolean
  }

  let { items, onItemElimination, subscriberOnly }: Props = $props()

  type Phase = 'voting' | 'blind_pick' | 'revealed'

  const STOP_LOCK_SECONDS = 15

  const chatStore = getChatStore()
  const musicStore = getMusicStore()

  $effect(() => {
    musicStore.play('rickroll')
    return () => musicStore.stop()
  })

  let voting = $state<TurnirVoting | null>(null)
  let phase = $state<Phase>('voting')
  let time = $state(0)
  let shuffledIds = $state<string[]>([])
  let markedId = $state<string | null>(null)

  let stopLocked = $derived(time < STOP_LOCK_SECONDS)

  let votesByOption = $derived.by(() => {
    const counts: Record<string, number> = {}
    for (const item of items) counts[item.id] = 0
    for (const vote of voting?.votes ?? []) {
      if (vote in counts) counts[vote] += 1
    }
    return counts
  })

  let itemById = $derived.by(() => {
    const map = new Map<string, Item>()
    for (const item of items) map.set(item.id, item)
    return map
  })

  $effect(() => {
    const next = new TurnirVoting(items, subscriberOnly)
    next.start()
    voting = next
    phase = 'voting'
    time = 0
    shuffledIds = []
    markedId = null
    const interval = setInterval(() => {
      time += 1
    }, 1000)
    return () => clearInterval(interval)
  })

  $effect(() => {
    const messages = chatStore.newMessages
    const current = voting
    if (!current) return
    untrack(() => {
      messages.forEach(current.handleMessage)
    })
  })

  function shuffle(ids: string[]): string[] {
    const arr = [...ids]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  function stopVoting() {
    voting?.finish()
    // Shuffled once here so the order stays stable for the rest of the round.
    shuffledIds = shuffle(items.map((item) => item.id))
    markedId = null
    phase = 'blind_pick'
  }

  function handleBlindClick(id: string) {
    markedId = id
    phase = 'revealed'
  }

  function handleRevealClick(id: string) {
    if (id === markedId) {
      onItemElimination(id)
    }
  }
</script>

<div>
  {#if phase === 'voting'}
    <Button variant="destructive" onclick={stopVoting} disabled={stopLocked}>
      Закончить {stopLocked ? ` (блокировка на ${STOP_LOCK_SECONDS - time} секунд)` : ''}
    </Button>
    <div class="mt-4">
      <PollResults {items} votes={voting?.votes ?? []} hideResults {time} />
    </div>
    <div class="mt-8">
      <VotesLog
        votes={voting?.voteMessages ?? []}
        {items}
        isFinished={false}
        hideVotes
        voteVerb=""
      />
    </div>
  {:else if phase === 'blind_pick'}
    <div class="grid justify-center">
      <InfoPanel>
        <p>Выбери вариант для удаления, не видя названий</p>
      </InfoPanel>
    </div>
    <div class="mt-4 flex justify-center">
      <div class="flex w-full max-w-md flex-col gap-2.5">
        {#each shuffledIds as id (id)}
          {@const item = itemById.get(id)}
          {#if item}
            <SelectItem
              {item}
              selected={false}
              hideTitle
              hideId
              endText={`голосов: ${votesByOption[id] ?? 0}`}
              highlightOnHover
              fullWidth
              onItemClick={handleBlindClick}
            />
          {/if}
        {/each}
      </div>
    </div>
  {:else}
    <div class="grid justify-center">
      <InfoPanel>
        <p>Названия открыты. Нажми на отмеченный вариант, чтобы удалить его</p>
      </InfoPanel>
    </div>
    <div class="mt-4 flex justify-center">
      <div
        class="grid w-full max-w-xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5"
      >
        {#each shuffledIds as id (id)}
          {@const item = itemById.get(id)}
          {#if item}
            <SelectItem
              {item}
              selected={id === markedId}
              fullWidth
              onItemClick={handleRevealClick}
            />
            <div class="text-lg leading-none">
              {votesByOption[id] ?? 0}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>

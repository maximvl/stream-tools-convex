<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { getChatStore } from '$lib/context'
  import { TurnirVoting } from '$lib/stores/turnirVoting.svelte'
  import type { Item } from '$lib/turnir/types'
  import { untrack } from 'svelte'
  import InfoPanel from './InfoPanel.svelte'
  import PollResults from './PollResults.svelte'
  import VotesLog from './VotesLog.svelte'

  type Props = {
    items: Item[]
    onItemElimination: (id: string) => void
    subscriberOnly: boolean
  }

  let { items, onItemElimination, subscriberOnly }: Props = $props()

  type Phase = 'voting' | 'streamer_choice' | 'show_results'

  const STOP_LOCK_SECONDS = 15

  const chatStore = getChatStore()
  let voting = $state<TurnirVoting | null>(null)
  let phase = $state<Phase>('voting')
  let time = $state(0)
  let targetNumber = $state(0)

  let stopLocked = $derived(time < STOP_LOCK_SECONDS)

  let maxVotes = $derived.by(() => {
    const counts: Record<string, number> = {}
    for (const item of items) counts[item.id] = 0
    for (const vote of voting?.votes ?? []) {
      if (vote in counts) counts[vote] += 1
    }
    return Math.max(0, ...Object.values(counts))
  })

  $effect(() => {
    const next = new TurnirVoting(items, subscriberOnly)
    next.start()
    voting = next
    phase = 'voting'
    time = 0
    targetNumber = 0
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

  function stopVoting() {
    voting?.finish()
    phase = 'streamer_choice'
  }

  function showResults() {
    phase = 'show_results'
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
    <div class="mt-4">
      <VotesLog
        votes={voting?.voteMessages ?? []}
        {items}
        isFinished={false}
        hideVotes
        voteVerb=""
      />
    </div>
  {:else if phase === 'streamer_choice'}
    <div class="grid justify-center">
      <InfoPanel>
        <p>Стример пытается угадать сколько голосов за разные варианты</p>
        <h3 class="font-bold">Будет удален вариант с наиболее близким числом голосов</h3>
      </InfoPanel>
    </div>
    <div class="m-8 flex items-center justify-center gap-4">
      <input
        type="range"
        aria-label="Количество голосов"
        class="w-3/5 accent-primary"
        min={0}
        max={Math.max(0, maxVotes)}
        step={1}
        bind:value={targetNumber}
      />
      <span class="min-w-12 text-center text-2xl font-black text-primary">{targetNumber}</span>
    </div>
    <Button class="bg-green-600 hover:bg-green-500" onclick={showResults}>Показать голоса</Button>
  {:else}
    <div class="grid justify-center">
      <InfoPanel>
        <p>Стример пытается угадать сколько голосов за разные варианты</p>
        <h3 class="font-bold">Будет удален вариант с наиболее близким числом голосов</h3>
      </InfoPanel>
    </div>
    <div class="m-8 flex items-center justify-center gap-4">
      <input
        type="range"
        aria-label="Количество голосов"
        class="w-3/5 accent-primary"
        disabled
        min={0}
        max={Math.max(0, maxVotes)}
        step={1}
        value={targetNumber}
      />
      <span class="min-w-12 text-center text-2xl font-black text-primary">{targetNumber}</span>
    </div>
    <PollResults
      {items}
      votes={voting?.votes ?? []}
      {onItemElimination}
      showInfo={false}
      winnerCheck={(count: number) => 1000 - Math.abs(count - Number(targetNumber))}
    />
  {/if}
</div>

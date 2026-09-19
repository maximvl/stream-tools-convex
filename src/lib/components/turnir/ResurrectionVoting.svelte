<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { getChatStore } from '$lib/context'
  import { TurnirVoting } from '$lib/stores/turnirVoting.svelte'
  import type { Item } from '$lib/turnir/types'
  import { untrack } from 'svelte'
  import PollResults from './PollResults.svelte'
  import VotesLog from './VotesLog.svelte'

  type Props = {
    items: Item[]
    onItemResurrection: (id: string) => void
    subscriberOnly: boolean
  }

  let { items, onItemResurrection, subscriberOnly }: Props = $props()

  type Phase = 'voting' | 'show_results'

  const chatStore = getChatStore()
  let voting = $state<TurnirVoting | null>(null)
  let phase = $state<Phase>('voting')
  let time = $state(0)

  $effect(() => {
    const next = new TurnirVoting(items, subscriberOnly)
    next.start()
    voting = next
    phase = 'voting'
    time = 0
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
    phase = 'show_results'
  }
</script>

<div>
  {#if phase === 'voting'}
    <Button variant="destructive" onclick={stopVoting}>Закончить</Button>
    <div class="mt-4">
      <PollResults {items} votes={voting?.votes ?? []} hideResults {time} />
    </div>
    <div class="mt-4">
      <VotesLog
        votes={voting?.voteMessages ?? []}
        {items}
        isFinished={false}
        hideVotes
        voteVerb="за"
      />
    </div>
  {:else}
    <PollResults
      {items}
      votes={voting?.votes ?? []}
      onItemElimination={onItemResurrection}
      showInfo={false}
    />
  {/if}
</div>

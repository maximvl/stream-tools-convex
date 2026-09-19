<script lang="ts">
  import { getChatStore } from '$lib/context'
  import { TurnirVoting } from '$lib/stores/turnirVoting.svelte'
  import type { Item } from '$lib/turnir/types'
  import { untrack } from 'svelte'
  import PollResults from './PollResults.svelte'
  import VotesLog from './VotesLog.svelte'

  type Props = {
    items: Item[]
    onItemElimination: (id: string) => void
    subscriberOnly: boolean
  }

  let { items, onItemElimination, subscriberOnly }: Props = $props()

  const chatStore = getChatStore()

  let time = $state(0)
  // Per-round instance: component is {#key roundId}, so items are fixed for its
  // lifetime. Created inside $effect so prop reads stay in a reactive context.
  let voting = $state<TurnirVoting | null>(null)

  $effect(() => {
    const next = new TurnirVoting(items, subscriberOnly)
    next.start()
    voting = next
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
</script>

<div class="inline-block w-full items-center pl-4">
  <PollResults {items} votes={voting?.votes ?? []} {onItemElimination} {time} />
  <div class="mt-4">
    <VotesLog
      votes={voting?.voteMessages ?? []}
      {items}
      isFinished={voting?.votingState === 'finished'}
    />
  </div>
</div>

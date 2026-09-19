import { SvelteMap } from 'svelte/reactivity'
import type { ChatMessageWithSource, UserId } from '$lib/types'
import type { Item } from '$lib/turnir/types'

export type TurnirVotingState = 'initial' | 'voting' | 'finished'

function isSubscriberMessage(msg: ChatMessageWithSource): boolean {
  const badges = msg.user.vkFields?.badges ?? []
  return badges.some((badge) => badge.achievement.type === 'subscription')
}

/**
 * Port of `useChatVoting`: last-vote-wins per user, only messages matching an
 * item id count. Instance is per-round (component is `{#key roundId}`), so no
 * need for the React `items.length` reset effect.
 */
export class TurnirVoting {
  votesMap = $state<SvelteMap<UserId, string>>(new SvelteMap())
  voteMessages = $state<ChatMessageWithSource[]>([])
  votingState = $state<TurnirVotingState>('initial')

  private itemIds: Set<string>

  constructor(
    items: Item[],
    private subscriberOnly: boolean = false,
  ) {
    this.itemIds = new Set(items.map((item) => item.id))
  }

  start() {
    this.votesMap = new SvelteMap()
    this.voteMessages = []
    this.votingState = 'voting'
  }

  finish() {
    this.votingState = 'finished'
  }

  get votes(): string[] {
    return [...this.votesMap.values()]
  }

  handleMessage = (msg: ChatMessageWithSource) => {
    if (this.votingState !== 'voting') return
    if (!this.itemIds.has(msg.text.trim())) return
    if (this.subscriberOnly && !isSubscriberMessage(msg)) return

    this.voteMessages.push(msg)
    this.votesMap.set(msg.user.id, msg.text.trim())
  }
}

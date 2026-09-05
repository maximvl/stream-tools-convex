import { SvelteMap } from 'svelte/reactivity'
import { LocalStore } from './localStore.svelte'
import type { UserId, ChatServer, ChatMessageWithSource } from '$lib/types'
import { createContext, untrack } from 'svelte'
import { TimerStore } from './timerStore.svelte'

export type VoteOption = {
  id: string
  text: string
}

export type Vote = {
  userId: UserId
  username: string
  optionIndex: number
  timestamp: number
  server: ChatServer
  previousOptionIndex?: number
}

export type VotingState = 'idle' | 'voting' | 'ended'

export class VotingStore {
  optionsStore: LocalStore<VoteOption[]>
  durationStore = new LocalStore<number>('voting-duration', 60)
  votingState = $state<VotingState>('idle')
  votes = $state<SvelteMap<UserId, Vote>>(new SvelteMap())
  timer = new TimerStore()

  constructor() {
    this.optionsStore = new LocalStore<VoteOption[]>('voting-options', [
      { id: crypto.randomUUID(), text: 'Вариант 1' },
      { id: crypto.randomUUID(), text: 'Вариант 2' },
    ])

    this.timer.limitMs = this.durationStore.value * 1000

    $effect(() => {
      if (this.timer.limitMs > 0 && this.timer.state === 'finished' && this.votingState === 'voting') {
        untrack(() => {
          this.endVoting()
        })
      }
    })
  }

  // Getters for options
  get options(): VoteOption[] {
    return this.optionsStore.value
  }

  set options(val: VoteOption[]) {
    this.optionsStore.value = val
  }

  addOption(text = '') {
    this.optionsStore.value.push({
      id: crypto.randomUUID(),
      text,
    })
  }

  removeOption(index: number) {
    if (this.optionsStore.value.length > 2) {
      this.optionsStore.value = this.optionsStore.value.filter((_, idx) => idx !== index)
    }
  }

  updateOption(index: number, text: string) {
    if (this.optionsStore.value[index]) {
      this.optionsStore.value[index].text = text
    }
  }

  startVoting() {
    this.votes = new SvelteMap()
    this.votingState = 'voting'

    // remove empty voting options
    this.optionsStore.value = this.optionsStore.value.filter((option) => option.text.trim() !== '')

    this.durationStore.value = this.timer.remainingSeconds
    this.timer.start()
  }

  endVoting() {
    this.votingState = 'ended'
    this.timer.stop()
  }

  resetVoting() {
    this.votes = new SvelteMap()
    this.votingState = 'idle'
    this.timer.stop()
  }

  handleMessage = (msg: ChatMessageWithSource) => {
    if (this.votingState !== 'voting') return

    const messageText = msg.text.trim()
    const num = parseInt(messageText, 10)

    // Check if the message is exactly the number of one of the options
    if (!isNaN(num) && num >= 1 && num <= this.options.length) {
      let previousOptionIndex: number | undefined
      const prevVote = this.votes.get(msg.user.id)
      if (prevVote) {
        previousOptionIndex = prevVote.optionIndex
      }

      this.votes.set(msg.user.id, {
        userId: msg.user.id,
        username: msg.user.displayName,
        optionIndex: num - 1,
        timestamp: msg.timestampMs,
        server: msg.source.server,
        previousOptionIndex,
      })
    }
  }

  // Derived properties
  totalVotes = $derived(this.votes.size)

  votesPerOption = $derived.by(() => {
    const counts = this.options.map(() => 0)
    this.votes.forEach((vote) => {
      if (vote.optionIndex >= 0 && vote.optionIndex < this.options.length) {
        counts[vote.optionIndex]++
      }
    })
    return counts
  })

  optionStats = $derived.by(() => {
    const total = this.totalVotes
    return this.options.map((option, idx) => {
      const count = this.votesPerOption[idx] || 0
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0
      return {
        ...option,
        count,
        percentage,
      }
    })
  })

  votesPerServerPerOption = $derived.by(() => {
    const counts = this.options.map(() => {
      const serverCounts: Record<ChatServer, number | undefined> = {
        twitch: undefined,
        vkvideo: undefined,
        kick: undefined,
        wtv: undefined,
      }
      return serverCounts
    })

    let hasTwitchVotes = false
    let hasVkvideoVotes = false
    let hasKickVotes = false
    let hasWtvVotes = false

    this.votes.forEach((vote) => {
      if (vote.optionIndex >= 0 && vote.optionIndex < this.options.length) {
        counts[vote.optionIndex][vote.server] = (counts[vote.optionIndex][vote.server] || 0) + 1
        if (vote.server === 'twitch') hasTwitchVotes = true
        if (vote.server === 'vkvideo') hasVkvideoVotes = true
        if (vote.server === 'kick') hasKickVotes = true
        if (vote.server === 'wtv') hasWtvVotes = true
      }
    })

    // Only show servers that have votes
    if (hasTwitchVotes) counts.forEach((c) => { if (c.twitch === undefined) c.twitch = 0 })
    if (hasVkvideoVotes) counts.forEach((c) => { if (c.vkvideo === undefined) c.vkvideo = 0 })
    if (hasKickVotes) counts.forEach((c) => { if (c.kick === undefined) c.kick = 0 })
    if (hasWtvVotes) counts.forEach((c) => { if (c.wtv === undefined) c.wtv = 0 })

    return counts
  })

  // Sorted options by vote count (for ended state)
  sortedStats = $derived.by(() => {
    return [...this.optionStats].sort((a, b) => b.count - a.count)
  })

  // Winners (highest vote count)
  winners = $derived.by(() => {
    if (this.totalVotes === 0) return []
    const maxCount = Math.max(...this.votesPerOption)
    if (maxCount === 0) return []
    return this.optionStats.filter((opt) => opt.count === maxCount)
  })
}

export const [getVotingStore, setVotingStore] = createContext<VotingStore>()

import type { ChatMessageWithSource, ChatUser, VkRole, VkRoleId } from '$lib/types'
import uniq from 'lodash/uniq'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'
import { LocalStore } from './localStore.svelte'
import type {
  LotoTicket,
  LotoTicketId,
  SuperGameReward,
  VkRewards,
} from '$lib/components/loto/types'
import { createContext, untrack } from 'svelte'
import shuffle from 'lodash/shuffle'
import { createLotoWinner, updateLotoWinner, type LotoWinner } from '$lib/api/loto'
import type { AuthStore } from './authStore.svelte'
import type { ChatServer } from '$lib/types'
import type { ConnKey } from './chatMessagesStore.svelte'

type GameState = 'registration' | 'playing'
type SuperGameState = 'not_started' | 'in_progress' | 'finished'

export type LotoConfig = {
  ticket_size: number
  max_number: number
  roll_animation_time: number
  enable_chat_tickets: boolean
  enable_points_tickets: boolean
  only_subscribers: boolean
  win_matches_amount: number
  manual_draw_enabled: boolean
  // limit_to_90: boolean
  allow_mods_to_input_numbers: boolean
  allow_tickets_after_start: boolean
  super_game_options_amount: number
  super_game_guesses_amount: number
  super_game_1_pointers: number
  super_game_2_pointers: number
  super_game_3_pointers: number
  super_game_bonus_guesses_enabled: boolean
  super_game_vk_rewards: VkRewards
  super_game_win_score: number
  super_game_bombs: number
}

export const DefaultConfig: LotoConfig = {
  ticket_size: 8,
  max_number: 99,
  roll_animation_time: 1500,
  enable_chat_tickets: true,
  enable_points_tickets: true,
  only_subscribers: false,
  win_matches_amount: 3,
  manual_draw_enabled: false,
  // limit_to_90: false,
  allow_mods_to_input_numbers: false,
  allow_tickets_after_start: true,
  super_game_options_amount: 99,
  super_game_guesses_amount: 7,
  super_game_1_pointers: 3,
  super_game_2_pointers: 2,
  super_game_3_pointers: 1,
  super_game_bonus_guesses_enabled: true,
  super_game_vk_rewards: {},
  super_game_win_score: 1,
  super_game_bombs: 1,
}

export class LotoStore {
  config: LocalStore<LotoConfig>

  drawPool = $state<string[]>([])
  drawnNumbers = $state<string[]>([])
  gameState = $state<GameState>('registration')
  nextNumber = $state<string>('')

  displayNextNumber = $state<string>('')
  isRolling = $state(false)

  // Backend tickets for the active game (gameId = instance id). The list
  // query in +page.svelte writes here via setRemoteTickets; all derived
  // views (ordering, winner) read from it. Local generation was removed —
  // tickets are created by the backend sync action polling chats itself.
  remoteTickets = $state<LotoTicket[]>([])
  gameId = $state<string | null>(null)

  // Set by the page (has Convex client + session): backend delete call.
  // Store still removes locally first for instant UI feedback.
  ticketRemover: ((ticketId: string) => void) | null = null

  superGameValues = $state<SuperGameReward[]>([])
  superGameGuesses = $state<number[]>([])
  superGameRevealedIds = $state<number[]>([])

  superGameWinChance = $derived.by(() => approximateWinChance(this.config.value))

  superGameTotalGuessesAmount = $derived.by(() => {
    const base = this.config.value.super_game_guesses_amount
    if (this.config.value.super_game_bonus_guesses_enabled) {
      const revealedNonEmpty = this.superGameRevealedIds.filter(
        (id) =>
          this.superGameValues[id].kind !== 'empty' && this.superGameValues[id].kind !== 'bomb',
      )
      return base + revealedNonEmpty.length
    }
    return base
  })
  superGameState: SuperGameState = $derived.by(() => {
    if (this.superGameGuesses.length === 0) {
      return 'not_started'
    }
    return this.superGameRevealedIds.length === this.superGameTotalGuessesAmount
      ? 'finished'
      : 'in_progress'
  })

  superGameScore = $derived.by(() => {
    const sum = this.superGameRevealedIds.reduce(
      (acc, id) => acc + getSuperGameRewardScore(this.superGameValues[id]),
      0,
    )
    return sum
  })

  superGameResult = $derived.by(() => {
    if (this.superGameScore >= this.config.value.super_game_win_score) {
      return 'win' as const
    }
    if (this.superGameState === 'finished') {
      return 'lose' as const
    }
    return 'in_progress' as const
  })

  usersById = $state<SvelteMap<string, ChatUser>>(new SvelteMap())
  openedChats = $state<Set<LotoTicketId>>(new SvelteSet())

  savedWinnerIds = $state<SvelteMap<string, string>>(new SvelteMap())

  authStore: AuthStore | null = null

  setAuthStore(store: AuthStore) {
    this.authStore = store
  }

  private isChannelAuthed(server: ChatServer, channel: string): boolean {
    if (!this.authStore) return true
    const info = this.authStore.connectionInfo[`${server}/${channel}` as ConnKey]
    // Fail closed: unknown status means not authed. Auth gates saving only —
    // loading history is public and never consults this.
    return info?.authenticated ?? false
  }

  // Direct Convex writes (no TanStack wrapper — TanStack stays reserved for
  // the external chats API). Failures are intentionally ignored, same as the
  // previous mutation objects whose error state nobody read.
  saveLotoWinner(params: {
    server: ChatServer
    channel: string
    winner: { username: string; super_game_status: 'skip' | 'win' | 'lose' }
  }) {
    createLotoWinner(params)
      .then((data) => {
        data.winners.forEach((w) => {
          this.savedWinnerIds.set(w.username, w.id)
        })
      })
      .catch(() => {})
  }

  updateLotoWinnerStatus(params: {
    id: string
    super_game_status: 'skip' | 'win' | 'lose'
    server: ChatServer
    channel: string
  }) {
    updateLotoWinner(params).catch(() => {})
  }

  constructor(config: LocalStore<LotoConfig>) {
    this.config = config
    this.drawPool = Array.from({ length: this.config.value.max_number }, (_, i) =>
      (i + 1).toString().padStart(2, '0'),
    )

    $effect(() => {
      void this.winner
      this.superGameGuesses = []
      this.superGameRevealedIds = []
      this.superGameValues = generateSuperGameValues(this.config.value)
    })

    $effect(() => {
      const winner = this.winner
      if (winner) {
        untrack(() => {
          this.openedChats.add(winner.id)
          if (!this.isChannelAuthed(winner.source.server, winner.source.channel)) return
          this.saveLotoWinner({
            server: winner.source.server,
            channel: winner.source.channel,
            winner: {
              super_game_status: 'skip',
              username: winner.owner_name,
            },
          })
        })
      }
    })

    $effect(() => {
      const winner = this.winner
      const superGameResult = this.superGameResult
      if (this.superGameState === 'finished' && winner && superGameResult !== 'in_progress') {
        untrack(() => {
          const winnerId = this.savedWinnerIds.get(winner.owner_name)
          if (!winnerId) return
          if (!this.isChannelAuthed(winner.source.server, winner.source.channel)) return

          this.updateLotoWinnerStatus({
            id: winnerId,
            super_game_status: superGameResult,
            server: winner.source.server,
            channel: winner.source.channel,
          })
        })
      }
    })
  }

  drawnNumbersSet = $derived(new SvelteSet(this.drawnNumbers))

  allTickets = $derived(this.remoteTickets)

  setGameId(gameId: string | null) {
    this.gameId = gameId
  }

  setRemoteTickets(tickets: LotoTicket[]) {
    this.remoteTickets = tickets
    // Keep user cards working for backend tickets even before the author
    // chats again (display polling only covers live messages).
    for (const t of tickets) {
      if (!this.usersById.has(t.owner_id)) {
        this.usersById.set(t.owner_id, {
          id: t.owner_id,
          displayName: t.owner_name,
        } as ChatUser)
      }
    }
  }

  streamerTickets = $derived(
    this.allTickets.filter(
      (ticket) =>
        ticket.owner_name.toLocaleLowerCase() === ticket.source.channel.toLocaleLowerCase(),
    ),
  )

  ticketsMatchData: Record<LotoTicketId, { score: number; maxSequentialMatch: number }> =
    $derived.by(() => {
      const result: Record<LotoTicketId, { score: number; maxSequentialMatch: number }> = {}
      for (const ticket of this.remoteTickets) {
        const match = getTicketMatch(ticket, this.drawnNumbersSet)
        result[ticket.id] = match
      }
      return result
    })

  ticketsOrdered = $derived.by(() => {
    if (this.gameState === 'registration') {
      return this.allTickets.toSorted((t1, t2) => t2.created_at - t1.created_at)
    }
    if (this.gameState === 'playing') {
      return this.allTickets.toSorted((t1, t2) => {
        const score1 = this.ticketsMatchData[t1.id]?.score ?? 0
        const score2 = this.ticketsMatchData[t2.id]?.score ?? 0
        if (score1 !== score2) {
          return score2 - score1
        }
        return t1.created_at - t2.created_at
      })
    }
    return []
  })

  winner = $derived.by(() => {
    const firstTicket = this.ticketsOrdered[0]
    if (firstTicket) {
      const match = this.ticketsMatchData[firstTicket.id]
      if (match && match.maxSequentialMatch >= this.config.value.win_matches_amount) {
        return firstTicket
      }
    }
    return null
  })

  winnerCandidates = $derived.by(() => {
    const candidates: SvelteSet<LotoTicketId> = new SvelteSet()
    if (this.winner) {
      const winnerMatch = this.ticketsMatchData[this.winner.id]
      const winnerScore = winnerMatch?.maxSequentialMatch ?? 0
      for (const ticket of this.ticketsOrdered.slice(0, 20)) {
        const match = this.ticketsMatchData[ticket.id]
        const score = match?.maxSequentialMatch ?? 0
        if (score === winnerScore) {
          candidates.add(ticket.id)
        }
      }
    }
    return candidates
  })

  winnerMatchedNumbers = $derived.by(() => {
    if (!this.winner) return []
    const drawnSet = new SvelteSet(this.drawnNumbers)
    const matches = this.winner.value.map((n) => drawnSet.has(n))

    let maxSeq = 0
    let maxSeqStartIndex = 0
    let currentSeq = 0
    let currentSeqStartIndex = 0

    for (let i = 0; i < matches.length; i++) {
      if (matches[i]) {
        if (currentSeq === 0) {
          currentSeqStartIndex = i
        }
        currentSeq++
        if (currentSeq > maxSeq) {
          maxSeq = currentSeq
          maxSeqStartIndex = currentSeqStartIndex
        }
      } else {
        currentSeq = 0
      }
    }

    return this.winner.value.slice(maxSeqStartIndex, maxSeqStartIndex + maxSeq)
  })

  vkRolesRewards = $state<Record<string, VkRole[]>>({})
  allVkRoles = $derived.by(() => {
    return Object.values(this.vkRolesRewards).flat()
  })

  winnersHistory = $state<Record<string, LotoWinner[]>>({})
  winnersFlatSorted = $derived.by(() => {
    return Object.values(this.winnersHistory)
      .flat()
      .sort((a, b) => b.created_at - a.created_at)
  })
  winsByUser = $derived.by(() => {
    const wins: Record<string, LotoWinner[]> = {}
    for (const winner of this.winnersFlatSorted) {
      if (!wins[winner.username]) {
        wins[winner.username] = []
      }
      wins[winner.username].push(winner)
    }
    return wins
  })

  handleMessage = (msg: ChatMessageWithSource) => {
    // Track users for display cards even though tickets now come from backend.
    if (!this.usersById.has(msg.user.id)) {
      this.usersById.set(msg.user.id, { ...msg.user })
    }

    if (this.winner && msg.user.id === this.winner.owner_id) {
      const numbers = parseSuperGameNumbers(msg.text, this.config.value)
      if (numbers.length > 0) {
        if (this.superGameGuesses.length < this.superGameTotalGuessesAmount) {
          this.superGameGuesses = uniq([...this.superGameGuesses, ...numbers]).slice(
            0,
            this.superGameTotalGuessesAmount,
          )
        }
        return
      }
    }
  }

  start = () => {
    this.gameState = 'playing'
  }

  newGame = () => {
    // Backend game creation assigns a fresh gameId (instance isolation);
    // the page wires this up — store just resets local round state.
    this.gameState = 'registration'
    this.drawnNumbers = []
    this.drawPool = Array.from({ length: this.config.value.max_number }, (_, i) =>
      (i + 1).toString().padStart(2, '0'),
    )
    this.remoteTickets = []
    this.openedChats = new SvelteSet()
  }

  deleteTicket = (ticketId: LotoTicketId) => {
    this.openedChats.delete(ticketId)
    this.remoteTickets = this.remoteTickets.filter((t) => t.id !== ticketId)
    this.ticketRemover?.(ticketId as string)
  }

  rollNextNumber = async () => {
    if (this.drawPool.length === 0 || this.isRolling) return

    const randomIndex = Math.floor(Math.random() * this.drawPool.length)
    const rolledNumber = this.drawPool[randomIndex]

    this.isRolling = true
    this.displayNextNumber = rolledNumber

    // Wait for the animation to complete
    await new Promise((resolve) => setTimeout(resolve, this.config.value.roll_animation_time))

    this.isRolling = false
    this.nextNumber = rolledNumber
    this.drawnNumbers.push(rolledNumber)
    this.drawPool = this.drawPool.filter((_, i) => i !== randomIndex)
  }
}

export const [getLotoStore, setLotoStore] = createContext<LotoStore>()

function getMaxSequentialMatches(matches: boolean[]) {
  let maxSeq = 0
  let currentSeq = 0
  for (const m of matches) {
    if (m) {
      currentSeq++
      maxSeq = Math.max(maxSeq, currentSeq)
    } else {
      currentSeq = 0
    }
  }
  return maxSeq
}

function getTicketMatch(ticket: LotoTicket, drawnSet: SvelteSet<string>) {
  const matches = ticket.value.map((n) => drawnSet.has(n))

  const maxSeq = getMaxSequentialMatches(matches)
  const totalMatches = matches.filter(Boolean).length

  // Weighting:
  // maxSeq is most important (e.g. * 1000)
  // totalMatches is next (e.g. * 1)
  return {
    score: maxSeq * 1000 + totalMatches,
    maxSequentialMatch: maxSeq,
  }
}

export function getLotoConfigStore() {
  const store = new LocalStore('loto-config', DefaultConfig)
  for (const key in DefaultConfig) {
    const typedKey = key as keyof LotoConfig
    if (store.value[typedKey] === undefined) {
      store.value = { ...store.value, [typedKey]: DefaultConfig[typedKey] }
    }
  }
  return store
}

function generateSuperGameValues(config: LotoConfig): SuperGameReward[] {
  const values: SuperGameReward[] = []

  for (let i = 0; i < config.super_game_1_pointers; i++) {
    values.push({ kind: 'x1' })
  }

  for (let i = 0; i < config.super_game_2_pointers; i++) {
    values.push({ kind: 'x2' })
  }

  for (let i = 0; i < config.super_game_3_pointers; i++) {
    values.push({ kind: 'x3' })
  }

  for (let i = 0; i < config.super_game_bombs; i++) {
    values.push({ kind: 'bomb' })
  }

  if (config.super_game_vk_rewards) {
    for (const roles of Object.values(config.super_game_vk_rewards)) {
      for (const [roleId, amount] of Object.entries(roles)) {
        for (let i = 0; i < amount; i++) {
          values.push({ kind: 'vk-role', roleId: roleId as VkRoleId })
        }
      }
    }
  }

  for (let i = values.length; i < config.super_game_options_amount; i++) {
    values.push({ kind: 'empty' })
  }

  return shuffle(values)
}

function getSuperGameRewardScore(reward: SuperGameReward): number {
  switch (reward.kind) {
    case 'empty':
      return 0
    case 'x1':
      return 1
    case 'x2':
      return 2
    case 'x3':
      return 3
    case 'vk-role':
      return 1
    case 'bomb':
      return -1
    default: {
      const error: never = reward
      throw new Error(`Unknown super game reward kind: ${error}`)
    }
  }
}

function parseSuperGameNumbers(message: string, config: LotoConfig): number[] {
  const cleaned = message
    .toLocaleLowerCase()
    .replace(/\+/g, '')
    .replace(/супер/g, '')
    .replace(/лото/g, '')
  const potentialNumbers = cleaned
    .split(' ')
    .filter((n) => n !== '')
    .map(Number)

  if (potentialNumbers.some((n) => isNaN(n))) {
    return []
  }

  return uniq(potentialNumbers.filter((n) => n >= 1 && n <= config.super_game_options_amount))
}

function approximateWinChance(cfg: LotoConfig): number {
  const N = cfg.super_game_options_amount
  const k = cfg.super_game_guesses_amount

  const A1 = cfg.super_game_1_pointers
  const A2 = cfg.super_game_2_pointers
  const A3 = cfg.super_game_3_pointers

  const B = cfg.super_game_bombs

  const p1 = A1 / N
  const p2 = A2 / N
  const p3 = A3 / N
  const pb = B / N

  // expected score per draw
  const meanPerDraw = 1 * p1 + 2 * p2 + 3 * p3 - 1 * pb

  // E[X²]
  const secondMoment = 1 * 1 * p1 + 2 * 2 * p2 + 3 * 3 * p3 + 1 * 1 * pb

  // Var(X) = E[X²] - E[X]²
  const variancePerDraw = secondMoment - meanPerDraw * meanPerDraw

  const mean = k * meanPerDraw

  const variance = k * variancePerDraw

  const stdDev = Math.sqrt(Math.max(variance, 1e-9))

  const z = (cfg.super_game_win_score - mean) / stdDev

  return 1 - normalCDF(z)
}

function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))

  const d = 0.3989423 * Math.exp((-x * x) / 2)

  let prob =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))

  if (x > 0) {
    prob = 1 - prob
  }

  return prob
}

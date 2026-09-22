import type {
  ChatMessageWithSource,
  ChatUser,
  UserId,
  VkMention,
  VkRole,
  VkRoleId,
} from '$lib/types'
import sampleSize from 'lodash/sampleSize'
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

const LOTO_MATCH = 'лото'
const VK_CHAT_BOT_NAME = 'ChatBot'

// Draft sent to the backend `loto.addTicket` mutation. The backend upserts
// on (game_id, owner_id), so resending from the same owner replaces the
// previous ticket ("last message wins").
export type LotoTicketDraft = {
  owner_id: string
  owner_name: string
  value: string[]
  type: 'chat' | 'points'
  source_server: string
  source_channel: string
  created_at: number
}

// Synthetic owner id for streamer tickets — mirrors backend
// `streamerOwnerId`. Sharing one id means a `+лото` message from the
// streamer upserts the generated streamer ticket instead of duplicating it.
export function streamerOwnerId(server: string, channel: string): string {
  return `streamer/${server}/${channel.toLowerCase()}`
}

// Ban-list key: display_name + stream channel, all case-insensitive.
// Mirrors backend (channel_lower, display_name_lower) matching.
export function banKey(server: string, channel: string, displayName: string): string {
  return `${server.toLowerCase()}/${channel.toLowerCase()}/${displayName.toLowerCase()}`
}

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
  // views (ordering, winner) read from it. Tickets are created in the
  // frontend from its chat polling (handleMessage) and persisted to the
  // backend via ticketSaver; the list subscription echoes them back.
  remoteTickets = $state<LotoTicket[]>([])
  gameId = $state<string | null>(null)

  // First-payload flags for the backend subscriptions. While a game is
  // active but its data hasn't arrived yet, the UI shows a loading message
  // instead of misleading empty states.
  ticketsLoaded = $state(false)
  gameLoaded = $state(false)
  backendSyncing = $derived(this.gameId !== null && (!this.ticketsLoaded || !this.gameLoaded))

  markTicketsLoaded() {
    this.ticketsLoaded = true
  }

  markGameLoaded() {
    this.gameLoaded = true
  }

  // Set by the page (has Convex client + session): backend delete call.
  // Store still removes locally first for instant UI feedback.
  ticketRemover: ((ticketId: string) => void) | null = null

  // Set by the page: backend ban call (creates a 7-day ban row for
  // display_name + stream channel and deletes the ticket).
  banSaver: ((ticketId: string) => void) | null = null

  // Ban list for the active channels, loaded by the page when a game
  // starts (frontend query of backend loto_bans). Keyed case-insensitively
  // as `server/channel/display_name`.
  bannedKeys = $state<SvelteSet<string>>(new SvelteSet())

  setBans(bans: { source_server: string; source_channel: string; display_name: string }[]) {
    this.bannedKeys = new SvelteSet(
      bans.map((b) => banKey(b.source_server, b.source_channel, b.display_name)),
    )
    // Drop already-collected tickets from newly banned users.
    if (this.remoteTickets.length > 0) {
      this.remoteTickets = this.remoteTickets.filter(
        (t) => !this.isBanned(t.source.server, t.source.channel, t.owner_name),
      )
    }
  }

  isBanned(server: string, channel: string, displayName: string): boolean {
    return this.bannedKeys.has(banKey(server, channel, displayName))
  }

  // Set by the page: persists a frontend-created ticket to the backend game.
  // Fire-and-forget cold backup for refresh restores; the live list never
  // re-syncs, so no confirmation comes back.
  ticketSaver: ((draft: LotoTicketDraft) => void) | null = null

  // Inserts a backend-created ticket (e.g. the streamer-ticket mutation
  // response) directly into the live list: with no live re-sync, the
  // mutation response is the only way the row appears locally. Replaces
  // any same-owner row, like the echo reconciliation did.
  upsertConfirmedTicket(t: LotoTicket) {
    for (const o of this.remoteTickets) {
      if (o.owner_id === t.owner_id && o.id !== t.id) {
        this.pendingTicketIds.delete(o.id)
      }
    }
    this.remoteTickets = [...this.remoteTickets.filter((o) => o.owner_id !== t.owner_id), t]
    if (!this.usersById.has(t.owner_id)) {
      this.usersById.set(t.owner_id, {
        id: t.owner_id,
        displayName: t.owner_name,
      } as ChatUser)
    }
  }

  // Adds a ticket to the local state and queues it for backend persistence
  // (via ticketSaver, a no-op when no backend game is attached). One ticket
  // per owner: resending from the same owner replaces the previous one.
  // Works fully offline — this is what keeps the game running with no
  // authed session (pure frontend mode).
  saveOptimisticTicket(t: LotoTicket) {
    // Banned users never get tickets, even on resend.
    if (this.isBanned(t.source.server, t.source.channel, t.owner_name)) return
    this.pendingTicketIds.add(t.id)
    // One ticket per owner: last message wins.
    this.remoteTickets = [...this.remoteTickets.filter((o) => o.owner_id !== t.owner_id), t]
    this.ticketSaver?.({
      owner_id: t.owner_id,
      owner_name: t.owner_name,
      value: t.value,
      type: t.type,
      source_server: t.source.server,
      source_channel: t.source.channel,
      created_at: t.created_at,
    })
  }

  // Generates the streamer ticket locally (pure frontend mode): samples a
  // fresh ticket for the given channel and upserts it on the synthetic
  // streamer id, mirroring backend `addStreamerTicket`. Pressing again
  // re-rolls. Rejected while a winner is set — same rule as chat tickets.
  addLocalStreamerTicket(server: ChatServer, channel: string) {
    if (this.winner) return
    const normalizedChannel = channel.toLowerCase()
    const ownerId = streamerOwnerId(server, normalizedChannel) as UserId
    const ticket: LotoTicket = {
      id: crypto.randomUUID() as LotoTicketId,
      owner_id: ownerId,
      owner_name: normalizedChannel,
      value: sampleSize(this.fullDrawPool(), this.config.value.ticket_size),
      color: 'random',
      variant: 1,
      type: 'chat',
      source: { server, channel: normalizedChannel },
      created_at: Date.now(),
      isLatecomer: false,
    }
    if (!this.usersById.has(ownerId)) {
      this.usersById.set(ownerId, { id: ownerId, displayName: normalizedChannel } as ChatUser)
    }
    this.saveOptimisticTicket(ticket)
  }

  // Set by the page: persists a rolled number to the backend game.
  // Rolls for a game with a winner set are ignored server-side.
  drawPusher: ((number: string) => void) | null = null

  // Set by the page: reports the derived winner to the backend game
  // (null clears, e.g. after the winning ticket is deleted). Frontend
  // ticket creation stops while a winner is set.
  winnerReporter: ((ticketId: string | null) => void) | null = null
  private lastReportedWinnerId: string | null | undefined = undefined

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
    this.drawPool = this.fullDrawPool()

    $effect(() => {
      // Report derived winner changes to the backend exactly once per id.
      // Skipped while tickets haven't loaded yet: on reload the derived
      // winner is briefly null and must not clear a stored backend winner.
      // Also skipped for optimistic rows created live (temp ids have no
      // backend counterpart — saves are fire-and-forget with no live
      // re-sync); restored rows already carry real backend ids.
      if (this.remoteTickets.length === 0) return
      const winnerId = this.winner?.id ?? null
      if (winnerId !== null && this.pendingTicketIds.has(winnerId)) return
      if (winnerId !== this.lastReportedWinnerId) {
        this.lastReportedWinnerId = winnerId
        untrack(() => {
          this.winnerReporter?.(winnerId)
        })
      }
    })

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
    if (gameId !== this.gameId) {
      this.ticketsLoaded = false
      this.gameLoaded = false
      this.gameCreatedAt = null
      this.gameFinishedAt = null
      this.backendWinnerTicketId = null
    }
    this.gameId = gameId
  }

  private fullDrawPool(): string[] {
    return Array.from({ length: this.config.value.max_number }, (_, i) =>
      (i + 1).toString().padStart(2, '0'),
    )
  }

  // Backend game subscription writes here. Draw pool is recomputed so a
  // reload or second tab converges to the same state. Any rolled numbers
  // mean the game already started — this is also what restores the
  // playing phase after a page refresh (gameState itself is local only).
  // Skips identical payloads: every backend write to the game row re-fires
  // the subscription, and a redundant commit mid-flight would replay the
  // ticket reorder animation (Svelte measures flip from the live position).
  setDrawnNumbers(numbers: string[]) {
    const current = this.drawnNumbers
    if (current.length === numbers.length && current.every((n, i) => n === numbers[i])) {
      return
    }
    this.drawnNumbers = [...numbers]
    const drawn = new SvelteSet(numbers)
    this.drawPool = this.fullDrawPool().filter((n) => !drawn.has(n))
    if (numbers.length > 0) {
      this.gameState = 'playing'
    }
  }

  // Backend game creation time, written by the game subscription. Used by
  // the page to detect stale games (old + zero tickets → auto-rotate).
  // Null until the first subscription payload arrives.
  gameCreatedAt = $state<number | null>(null)

  // Backend game finish time + winner id, written by the game
  // subscription. Used by the page to skip restoring long-finished games
  // (start a fresh one instead). Null until the first payload arrives, and
  // for games that never finished.
  gameFinishedAt = $state<number | null>(null)
  backendWinnerTicketId = $state<string | null>(null)

  setGameFinishedAt(finishedAt: number | null | undefined) {
    this.gameFinishedAt = finishedAt ?? null
  }

  setBackendWinnerTicketId(ticketId: string | null | undefined) {
    this.backendWinnerTicketId = ticketId ?? null
  }

  setGameCreatedAt(createdAt: number) {
    this.gameCreatedAt = createdAt
  }

  // Temp ids of optimistic tickets not yet confirmed by the backend echo.
  // Lets setRemoteTickets tell "not yet saved" apart from "deleted on the
  // backend": only rows in this set are kept when their owner is absent
  // from the incoming backend list.
  private pendingTicketIds = new Set<string>()

  setRemoteTickets(tickets: LotoTicket[]) {
    // Ignore banned users even if the backend echo still carries them
    // (e.g. banned after the ticket was stored, before banUser deleted it).
    const visible = tickets.filter(
      (t) => !this.isBanned(t.source.server, t.source.channel, t.owner_name),
    )
    const incomingOwners = new Set(visible.map((t) => t.owner_id))
    const keptPending: LotoTicket[] = []
    for (const t of this.remoteTickets) {
      if (this.pendingTicketIds.has(t.id)) {
        if (incomingOwners.has(t.owner_id)) {
          // Backend echo arrived (matched by owner_id) — drop the temp row.
          this.pendingTicketIds.delete(t.id)
        } else {
          keptPending.push(t)
        }
      }
    }
    // Backend is the source of truth; unconfirmed optimistic rows are kept
    // on top so they stay visible until the echo replaces them.
    const next = [...keptPending, ...visible]
    // Skip identical payloads: every ticket write re-fires the subscription,
    // and a redundant commit mid-flight would replay the ticket reorder
    // animation (Svelte measures flip from the live position). User cards
    // for an unchanged list are already present, so nothing else to do.
    if (
      next.length === this.remoteTickets.length &&
      next.every((t, i) => {
        const c = this.remoteTickets[i]
        return (
          t.id === c.id &&
          t.owner_id === c.owner_id &&
          t.owner_name === c.owner_name &&
          t.type === c.type &&
          t.created_at === c.created_at &&
          t.source.server === c.source.server &&
          t.source.channel === c.source.channel &&
          t.value.length === c.value.length &&
          t.value.every((n, j) => n === c.value[j])
        )
      })
    ) {
      return
    }
    this.remoteTickets = next
    // Keep user cards working for backend tickets even before the author
    // chats again (display polling only covers live messages).
    for (const t of visible) {
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
    // Track users for display cards.
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

    if (this.winner) {
      return
    }

    if (!msg.text.toLowerCase().includes(LOTO_MATCH)) {
      return
    }

    if (this.gameState !== 'registration' && !this.config.value.allow_tickets_after_start) {
      return
    }

    const ticket = makeTicket({ chatMessage: msg, pool: this.drawPool, config: this.config.value })
    const user: ChatUser = {
      ...msg.user,
    }

    // The channel owner shares the synthetic streamer id, so a later `+лото`
    // message from the streamer upserts the generated streamer ticket
    // instead of duplicating it (backend matches on owner_id).
    const ownerIdFor = (displayName: string, fallbackId: string): string =>
      displayName.toLowerCase() === msg.source.channel.toLowerCase()
        ? streamerOwnerId(msg.source.server, msg.source.channel)
        : fallbackId

    const saveOptimistic = (t: LotoTicket) => {
      this.saveOptimisticTicket(t)
    }

    if (isMessageFromVkBot(msg)) {
      const mention = msg.vkFields?.mentions[0] as VkMention | undefined
      if (mention) {
        if (this.isBanned(msg.source.server, msg.source.channel, mention.displayName)) return
        user.id = mention.id.toString() as UserId
        user.displayName = mention.displayName
        const existingUser = this.usersById.get(user.id)
        if (!existingUser) {
          user.vkFields = undefined
          this.usersById.set(user.id, user)
        }

        ticket.type = 'points'
        ticket.owner_id = ownerIdFor(user.displayName, user.id) as UserId
        ticket.owner_name = user.displayName
        saveOptimistic(ticket)
      }
      return
    }
    if (isMessageHighlightedOnTwitch(msg)) {
      if (this.isBanned(msg.source.server, msg.source.channel, user.displayName)) return
      ticket.type = 'points'
      ticket.owner_id = ownerIdFor(user.displayName, user.id) as UserId
      this.usersById.set(ticket.owner_id, user)
      saveOptimistic(ticket)
      return
    }
    // regular ticket
    if (this.isBanned(msg.source.server, msg.source.channel, user.displayName)) return
    ticket.owner_id = ownerIdFor(user.displayName, user.id) as UserId
    this.usersById.set(ticket.owner_id, user)
    saveOptimistic(ticket)
  }

  start = () => {
    this.gameState = 'playing'
  }

  newGame = () => {
    // Backend game creation assigns a fresh gameId (instance isolation);
    // the page wires this up — store just resets local round state.
    this.gameState = 'registration'
    this.drawnNumbers = []
    this.drawPool = this.fullDrawPool()
    this.remoteTickets = []
    this.pendingTicketIds.clear()
    this.gameFinishedAt = null
    this.backendWinnerTicketId = null
    this.openedChats = new SvelteSet()
    this.lastReportedWinnerId = null
  }

  deleteTicket = (ticketId: LotoTicketId) => {
    const key = ticketId as string
    const wasPending = this.pendingTicketIds.has(key)
    this.openedChats.delete(ticketId)
    this.pendingTicketIds.delete(key)
    this.remoteTickets = this.remoteTickets.filter((t) => t.id !== ticketId)
    // Only restored rows (whose local id already is the backend id) exist
    // on the backend under a known id — optimistic rows are fire-and-forget
    // saves with no id mapping, so there is nothing addressable to delete.
    const persistedId = !wasPending ? key : null
    if (persistedId) this.ticketRemover?.(persistedId)
    // Deleting the reported winner clears the backend field.
    if (persistedId !== null && persistedId === this.lastReportedWinnerId) {
      this.lastReportedWinnerId = null
      this.winnerReporter?.(null)
    }
  }

  banTicket = (ticketId: LotoTicketId) => {
    const ticket = this.remoteTickets.find((t) => t.id === ticketId)
    if (ticket) {
      // Block re-registration immediately, even before the ban list reloads.
      this.bannedKeys.add(banKey(ticket.source.server, ticket.source.channel, ticket.owner_name))
    }
    const key = ticketId as string
    const wasPending = this.pendingTicketIds.has(key)
    this.openedChats.delete(ticketId)
    this.pendingTicketIds.delete(key)
    this.remoteTickets = this.remoteTickets.filter((t) => t.id !== ticketId)
    const persistedId = !wasPending ? key : null
    if (persistedId) this.banSaver?.(persistedId)
    // Banning the reported winner clears the backend field.
    if (persistedId !== null && persistedId === this.lastReportedWinnerId) {
      this.lastReportedWinnerId = null
      this.winnerReporter?.(null)
    }
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
    // Persist to backend (source of truth for all tabs); the game
    // subscription echoes it back. Ignored server-side once a winner is set.
    this.drawPusher?.(rolledNumber)
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

function makeTicket(params: {
  chatMessage: ChatMessageWithSource
  pool: string[]
  config: LotoConfig
}): LotoTicket {
  const { chatMessage, pool, config } = params

  const ticketNumber = genTicketNumber({
    text: chatMessage.text,
    pool,
    config,
  })
  return {
    id: crypto.randomUUID() as LotoTicketId,
    owner_id: chatMessage.user.id,
    owner_name: chatMessage.user.displayName,
    value: ticketNumber,
    color: 'random',
    variant: 1,
    type: 'chat',
    source: chatMessage.source,
    created_at: chatMessage.timestampMs,
    isLatecomer: false,
  }
}

function genTicketNumber(params: { text: string; pool: string[]; config: LotoConfig }): string[] {
  const { pool, config } = params

  const text = params.text.trim()
  if (text.length === 0) {
    return sampleSize(pool, config.ticket_size)
  }

  const ticketNumber = uniq(
    text
      .split(' ')
      .map((n) => parseInt(n))
      .filter((n) => n >= 1 && n <= config.max_number)
      .map((n) => n.toString().padStart(2, '0'))
      .filter((n) => pool.includes(n)),
  )

  if (ticketNumber.length < config.ticket_size) {
    const sampleOptions = sampleSize(pool, 10)
    const validOptions = sampleOptions.filter((o) => !ticketNumber.includes(o))
    ticketNumber.push(...sampleSize(validOptions, config.ticket_size - ticketNumber.length))
  }

  return ticketNumber.slice(0, config.ticket_size)
}

function isMessageFromVkBot(msg: ChatMessageWithSource) {
  return msg.source.server === 'vkvideo' && msg.user.displayName === VK_CHAT_BOT_NAME
}

function isMessageHighlightedOnTwitch(msg: ChatMessageWithSource) {
  return msg.source.server === 'twitch' && Boolean(msg.user.twitchFields?.highlighted)
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

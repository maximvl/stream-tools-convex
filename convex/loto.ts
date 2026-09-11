import { action, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { fetchChatMessagesBatch, type ChatServiceMessage } from './chatService'
import { toFrontendTicket, type FrontendTicket } from './lotoLib'

const LOTO_MATCH = 'лото'
const VK_CHAT_BOT_NAME = 'ChatBot'
const DEFAULT_TICKET_SIZE = 8
const DEFAULT_MAX_NUMBER = 99

// ---- Pure ticket-number helpers (ported from lotoStore.svelte.ts) ----

function fullPool(maxNumber: number): string[] {
  return Array.from({ length: maxNumber }, (_, i) => (i + 1).toString().padStart(2, '0'))
}

function sampleUnique(pool: string[], n: number): string[] {
  const arr = [...pool]
  for (let i = arr.length - 1; i > 0; i--) {
    const bytes = crypto.getRandomValues(new Uint8Array(4))
    const rand = new DataView(bytes.buffer).getUint32(0, false) / 0x100000000
    const j = Math.floor(rand * (i + 1))
    const a = arr[i] as string
    const b = arr[j] as string
    arr[i] = b
    arr[j] = a
  }
  return arr.slice(0, n)
}

function genTicketNumber(
  text: string,
  pool: string[],
  ticketSize: number,
  maxNumber: number,
): string[] {
  const trimmed = text.trim()
  if (trimmed.length === 0) return sampleUnique(pool, ticketSize)
  const parsed = [
    ...new Set(
      trimmed
        .split(' ')
        .map((n) => parseInt(n))
        .filter((n) => n >= 1 && n <= maxNumber)
        .map((n) => n.toString().padStart(2, '0'))
        .filter((n) => pool.includes(n)),
    ),
  ]
  if (parsed.length < ticketSize) {
    const options = sampleUnique(pool, 10).filter((o) => !parsed.includes(o))
    parsed.push(...sampleUnique(options, ticketSize - parsed.length))
  }
  return parsed.slice(0, ticketSize)
}

type TicketDraft = {
  owner_id: string
  owner_name: string
  value: string[]
  type: 'chat' | 'points'
  source_server: string
  source_channel: string
  created_at: number
}

function draftFromMessage(
  msg: ChatServiceMessage,
  sourceServer: string,
  sourceChannel: string,
  pool: string[],
  ticketSize: number,
  maxNumber: number,
): TicketDraft | null {
  if (!msg.text.toLowerCase().includes(LOTO_MATCH)) return null
  const user = msg.user
  if (user.displayName.length === 0) return null
  const mention = msg.vkFields?.mentions?.[0]

  // VK points ticket via ChatBot mention
  if (sourceServer === 'vkvideo' && user.displayName === VK_CHAT_BOT_NAME && mention) {
    return {
      owner_id: String(mention.id),
      owner_name: mention.displayName,
      value: genTicketNumber(msg.text, pool, ticketSize, maxNumber),
      type: 'points',
      source_server: sourceServer,
      source_channel: sourceChannel,
      created_at: msg.timestampMs,
    }
  }
  // Twitch points ticket via highlight
  if (sourceServer === 'twitch' && user.twitchFields?.highlighted === true) {
    return {
      owner_id: user.id,
      owner_name: user.displayName,
      value: genTicketNumber(msg.text, pool, ticketSize, maxNumber),
      type: 'points',
      source_server: sourceServer,
      source_channel: sourceChannel,
      created_at: msg.timestampMs,
    }
  }
  // Regular chat ticket
  return {
    owner_id: user.id,
    owner_name: user.displayName,
    value: genTicketNumber(msg.text, pool, ticketSize, maxNumber),
    type: 'chat',
    source_server: sourceServer,
    source_channel: sourceChannel,
    created_at: msg.timestampMs,
  }
}

// ---- Public API ----

export const createGame = mutation({
  args: { session_id: v.string(), channels: v.array(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now()
    const game_id = await ctx.db.insert('loto_games', {
      owner_session_id: args.session_id,
      channels: args.channels,
      last_seen_ts: now,
      created_at: now,
    })
    return { game_id }
  },
})

export const gamesForSession = query({
  args: { session_id: v.string() },
  handler: async (ctx, args) => {
    const games = await ctx.db
      .query('loto_games')
      .withIndex('by_session', (q) => q.eq('owner_session_id', args.session_id))
      .collect()
    return games
      .sort((a, b) => b.created_at - a.created_at)
      .map((g) => ({
        game_id: g._id,
        channels: g.channels,
        last_seen_ts: g.last_seen_ts,
        created_at: g.created_at,
      }))
  },
})

export const setChannels = mutation({
  args: { game_id: v.id('loto_games'), session_id: v.string(), channels: v.array(v.string()) },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.game_id)
    if (!game) throw new Error('Game not found')
    if (game.owner_session_id !== args.session_id) throw new Error('Not the game owner')
    await ctx.db.patch(args.game_id, { channels: args.channels })
    return { game_id: args.game_id, channels: args.channels }
  },
})

export const list = query({
  args: { game_id: v.id('loto_games') },
  handler: async (ctx, args): Promise<{ tickets: FrontendTicket[] }> => {
    const tickets = await ctx.db
      .query('loto_tickets')
      .withIndex('by_game', (q) => q.eq('game_id', args.game_id))
      .collect()
    return {
      tickets: tickets.sort((a, b) => b.created_at - a.created_at).map((t) => toFrontendTicket(t)),
    }
  },
})

export const removeTicket = mutation({
  args: { ticket_id: v.id('loto_tickets'), session_id: v.string() },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticket_id)
    if (!ticket) throw new Error('Ticket not found')
    const game = await ctx.db.get(ticket.game_id)
    if (!game || game.owner_session_id !== args.session_id) throw new Error('Not the game owner')
    await ctx.db.delete(args.ticket_id)
    return { deleted: args.ticket_id }
  },
})

// Poller: backend fetches chats itself via chatService, generates tickets,
// upserts them, advances last_seen_ts. The frontend calls this on an
// interval — the call is only a timer, all chat I/O happens here.
export const sync = action({
  args: {
    game_id: v.id('loto_games'),
    session_id: v.string(),
    ticket_size: v.optional(v.number()),
    max_number: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ tickets: FrontendTicket[]; synced: number }> => {
    const game = await ctx.runQuery(internal.lotoLib.getGame, { game_id: args.game_id })
    if (!game) throw new Error('Game not found')
    if (game.owner_session_id !== args.session_id) throw new Error('Not the game owner')
    const ticketSize = args.ticket_size ?? DEFAULT_TICKET_SIZE
    const maxNumber = args.max_number ?? DEFAULT_MAX_NUMBER
    const pool = fullPool(maxNumber)
    const tsFrom = game.last_seen_ts

    const byChannel = await fetchChatMessagesBatch(game.channels, tsFrom)
    const drafts: TicketDraft[] = []
    let maxSeen = tsFrom
    for (const streamChannel of game.channels) {
      const sep = streamChannel.indexOf('/')
      const sourceServer = sep > 0 ? streamChannel.slice(0, sep) : streamChannel
      const sourceChannel = sep > 0 ? streamChannel.slice(sep + 1) : streamChannel
      for (const m of byChannel.get(streamChannel) ?? []) {
        if (m.timestampMs > maxSeen) maxSeen = m.timestampMs
        const draft = draftFromMessage(m, sourceServer, sourceChannel, pool, ticketSize, maxNumber)
        if (draft) drafts.push(draft)
      }
    }
    // One ticket per owner: last message wins within the batch.
    const byOwner = new Map<string, TicketDraft>()
    for (const d of drafts) byOwner.set(d.owner_id, d)

    if (byOwner.size > 0) {
      await ctx.runMutation(internal.lotoLib.saveBatch, {
        game_id: args.game_id,
        tickets: [...byOwner.values()],
      })
    }
    if (maxSeen > tsFrom) {
      await ctx.runMutation(internal.lotoLib.touchSeen, {
        game_id: args.game_id,
        last_seen_ts: maxSeen,
      })
    }
    const tickets = await ctx.runQuery(internal.lotoLib.listTickets, { game_id: args.game_id })
    return { tickets, synced: byOwner.size }
  },
})

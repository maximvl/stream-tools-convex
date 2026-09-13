import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { streamerOwnerId, toFrontendTicket, type FrontendTicket } from './lotoLib'
import { compareChannelPriority } from './authLib'
import { parseIdentity } from './userIdentity'

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

// ---- Public API ----

export const createGame = mutation({
  args: {
    session_id: v.string(),
    channels: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const game_id = await ctx.db.insert('loto_games', {
      owner_session_id: args.session_id,
      channels: args.channels,
      created_at: now,
      drawn_numbers: [],
      tickets_amount: 0,
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
        created_at: g.created_at,
        drawn_numbers: g.drawn_numbers,
        winner_ticket_id: g.winner_ticket_id,
        tickets_amount: g.tickets_amount ?? 0,
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

// Generates a ticket for the streamer's main channel (platform priority:
// twitch > kick > vkvideo > wtv, same as auth). Upserts on the synthetic
// streamer id, so pressing again re-rolls instead of duplicating. Rejected
// once a winner is set — same rule as rolls.
export const addStreamerTicket = mutation({
  args: {
    game_id: v.id('loto_games'),
    session_id: v.string(),
    ticket_size: v.optional(v.number()),
    max_number: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.game_id)
    if (!game) throw new Error('Game not found')
    if (game.owner_session_id !== args.session_id) throw new Error('Not the game owner')
    if (game.winner_ticket_id !== undefined) throw new Error('Game already has a winner')

    const parsed = game.channels.flatMap((c) => {
      try {
        const identity = parseIdentity(c)
        return [{ ...identity, stream_channel: c }]
      } catch {
        return []
      }
    })
    if (parsed.length === 0) throw new Error('Game has no valid channels')
    parsed.sort(compareChannelPriority)
    const main = parsed[0] as { platform: string; user_slug: string }
    const channel = main.user_slug.toLowerCase()

    const ticketSize = args.ticket_size ?? DEFAULT_TICKET_SIZE
    const maxNumber = args.max_number ?? DEFAULT_MAX_NUMBER
    const ticket = {
      owner_id: streamerOwnerId(main.platform, channel),
      owner_name: channel,
      value: sampleUnique(fullPool(maxNumber), ticketSize),
      type: 'chat' as const,
      source_server: main.platform,
      source_channel: channel,
      created_at: Date.now(),
    }
    const existing = await ctx.db
      .query('loto_tickets')
      .withIndex('by_game_owner', (q) =>
        q.eq('game_id', args.game_id).eq('owner_id', ticket.owner_id),
      )
      .unique()
    let id: Id<'loto_tickets'>
    if (existing) {
      await ctx.db.patch(existing._id, {
        owner_name: ticket.owner_name,
        value: ticket.value,
        type: ticket.type,
        source_server: ticket.source_server,
        source_channel: ticket.source_channel,
        created_at: ticket.created_at,
      })
      id = existing._id
    } else {
      id = await ctx.db.insert('loto_tickets', {
        game_id: args.game_id,
        ...ticket,
        color: 'random',
        variant: 1,
        isLatecomer: false,
      })
      // New owner — count it. Re-rolls patch in place and don't double-count.
      await ctx.db.patch(args.game_id, { tickets_amount: (game.tickets_amount ?? 0) + 1 })
    }
    const row = await ctx.db.get(id)
    if (!row) throw new Error('Ticket not found')
    return { ticket: toFrontendTicket(row) }
  },
})

// Frontend-created ticket (one ticket per owner: resending from the same
// owner replaces the previous ticket — "last message wins"). Tickets are
// generated in the frontend from its chat polling and persisted here.
export const addTicket = mutation({
  args: {
    game_id: v.id('loto_games'),
    session_id: v.string(),
    owner_id: v.string(),
    owner_name: v.string(),
    value: v.array(v.string()),
    type: v.union(v.literal('chat'), v.literal('points')),
    source_server: v.string(),
    source_channel: v.string(),
    created_at: v.number(),
  },
  handler: async (ctx, args): Promise<{ ticket: FrontendTicket }> => {
    const game = await ctx.db.get(args.game_id)
    if (!game) throw new Error('Game not found')
    if (game.owner_session_id !== args.session_id) throw new Error('Not the game owner')
    if (game.winner_ticket_id !== undefined) throw new Error('Game already has a winner')
    if (args.owner_id.length === 0) throw new Error('Invalid owner_id')
    if (args.owner_name.length === 0) throw new Error('Invalid owner_name')
    if (args.value.length === 0 || args.value.length > 99) throw new Error('Invalid value')
    for (const n of args.value) {
      if (!/^\d{2}$/.test(n)) throw new Error('Invalid number')
    }
    const draft = {
      owner_id: args.owner_id,
      owner_name: args.owner_name,
      value: args.value,
      type: args.type,
      source_server: args.source_server,
      source_channel: args.source_channel,
      created_at: args.created_at,
    }
    const existing = await ctx.db
      .query('loto_tickets')
      .withIndex('by_game_owner', (q) =>
        q.eq('game_id', args.game_id).eq('owner_id', args.owner_id),
      )
      .unique()
    let id: Id<'loto_tickets'>
    if (existing) {
      await ctx.db.patch(existing._id, draft)
      id = existing._id
    } else {
      id = await ctx.db.insert('loto_tickets', {
        game_id: args.game_id,
        ...draft,
        color: 'random',
        variant: 1,
        isLatecomer: false,
      })
      // New owner — count it. Resends from the same owner patch in place
      // and don't double-count.
      await ctx.db.patch(args.game_id, { tickets_amount: (game.tickets_amount ?? 0) + 1 })
    }
    const row = await ctx.db.get(id)
    if (!row) throw new Error('Ticket not found')
    return { ticket: toFrontendTicket(row) }
  },
})

export const getGame = query({
  args: { game_id: v.id('loto_games') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.game_id)
    if (!game) return null
    return {
      game_id: game._id,
      channels: game.channels,
      drawn_numbers: game.drawn_numbers,
      winner_ticket_id: game.winner_ticket_id,
      created_at: game.created_at,
      tickets_amount: game.tickets_amount ?? 0,
    }
  },
})

// Browser picks the rolled number (keeps the roll animation in sync);
// backend stores it as source of truth. Rolls for a game that already has
// a winner are ignored.
export const pushDrawnNumber = mutation({
  args: { game_id: v.id('loto_games'), session_id: v.string(), number: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.game_id)
    if (!game) throw new Error('Game not found')
    if (game.owner_session_id !== args.session_id) throw new Error('Not the game owner')
    if (game.winner_ticket_id !== undefined)
      return { ignored: true as const, drawn_numbers: game.drawn_numbers }
    if (!/^\d{2}$/.test(args.number)) throw new Error('Invalid number')
    if (!game.drawn_numbers.includes(args.number)) {
      await ctx.db.patch(args.game_id, { drawn_numbers: [...game.drawn_numbers, args.number] })
    }
    const updated = await ctx.db.get(args.game_id)
    return { ignored: false as const, drawn_numbers: updated?.drawn_numbers ?? game.drawn_numbers }
  },
})

// Frontend winner watcher reports the derived winner (or null to clear,
// e.g. after the winning ticket is deleted).
export const setWinner = mutation({
  args: {
    game_id: v.id('loto_games'),
    session_id: v.string(),
    ticket_id: v.optional(v.id('loto_tickets')),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.game_id)
    if (!game) throw new Error('Game not found')
    if (game.owner_session_id !== args.session_id) throw new Error('Not the game owner')
    if (args.ticket_id !== undefined) {
      const ticket = await ctx.db.get(args.ticket_id)
      if (!ticket || ticket.game_id !== args.game_id) throw new Error('Ticket not found in game')
    }
    await ctx.db.patch(args.game_id, { winner_ticket_id: args.ticket_id })
    return { winner_ticket_id: args.ticket_id }
  },
})

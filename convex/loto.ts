import { action, internalAction, mutation, query, type ActionCtx } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { fetchChatMessagesBatch, type ChatServiceMessage } from './chatService'
import { LOTO_TTL_MS, streamerOwnerId, toFrontendTicket, type FrontendTicket } from './lotoLib'
import { compareChannelPriority } from './authLib'
import { parseIdentity } from './userIdentity'

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

  // The channel owner shares the synthetic streamer id, so a later `+лото`
  // message from the streamer upserts the generated ticket instead of
  // duplicating it (saveBatch matches on owner_id).
  const ownerIdFor = (displayName: string, fallbackId: string): string =>
    displayName.toLowerCase() === sourceChannel.toLowerCase()
      ? streamerOwnerId(sourceServer, sourceChannel)
      : fallbackId

  // VK points ticket via ChatBot mention
  if (sourceServer === 'vkvideo' && user.displayName === VK_CHAT_BOT_NAME && mention) {
    return {
      owner_id: ownerIdFor(mention.displayName, String(mention.id)),
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
      owner_id: ownerIdFor(user.displayName, user.id),
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
    owner_id: ownerIdFor(user.displayName, user.id),
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
  args: {
    session_id: v.string(),
    channels: v.array(v.string()),
    ticket_size: v.optional(v.number()),
    max_number: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const game_id = await ctx.db.insert('loto_games', {
      owner_session_id: args.session_id,
      channels: args.channels,
      last_seen_ts: now,
      created_at: now,
      drawn_numbers: [],
    })
    // Start the polling worker: each tick schedules the next one, so the
    // loop lives entirely in the backend (background tabs get throttled).
    // Poll params travel in the scheduler args — nothing is snapshotted.
    await ctx.scheduler.runAfter(2000, internal.loto.pollTick, {
      game_id,
      ticket_size: args.ticket_size,
      max_number: args.max_number,
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
        drawn_numbers: g.drawn_numbers,
        winner_ticket_id: g.winner_ticket_id,
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
    }
    const row = await ctx.db.get(id)
    if (!row) throw new Error('Ticket not found')
    return { ticket: toFrontendTicket(row) }
  },
})

// One incremental chat→tickets import: fetch messages since last_seen_ts,
// generate tickets, upsert, advance the watermark. Shared by the public
// `sync` (manual poke) and the `pollTick` worker loop.
async function pollOnce(
  ctx: ActionCtx,
  args: { game_id: Id<'loto_games'>; ticketSize: number; maxNumber: number },
): Promise<{ synced: number }> {
  const game = await ctx.runQuery(internal.lotoLib.getGame, { game_id: args.game_id })
  if (!game) throw new Error('Game not found')
  const pool = fullPool(args.maxNumber)
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
      const draft = draftFromMessage(
        m,
        sourceServer,
        sourceChannel,
        pool,
        args.ticketSize,
        args.maxNumber,
      )
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
  return { synced: byOwner.size }
}

// Manual one-shot poll (debugging / poke). The live loop is `pollTick`.
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
    const { synced } = await pollOnce(ctx, {
      game_id: args.game_id,
      ticketSize: args.ticket_size ?? DEFAULT_TICKET_SIZE,
      maxNumber: args.max_number ?? DEFAULT_MAX_NUMBER,
    })
    const tickets = await ctx.runQuery(internal.lotoLib.listTickets, { game_id: args.game_id })
    return { tickets, synced }
  },
})

const POLL_INTERVAL_MS = 2000

// Backend polling worker. Started by `createGame`; each tick schedules the
// next one, so no frontend timer is needed (background tabs get throttled).
// Stops when a winner is set, the game vanishes, has no channels, or ages
// past the eviction TTL. Deliberately no cron backstop: a broken chain
// freezes the game until a new one starts.
export const pollTick = internalAction({
  args: {
    game_id: v.id('loto_games'),
    ticket_size: v.optional(v.number()),
    max_number: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ polling: boolean; reason?: string; synced?: number }> => {
    const game = await ctx.runQuery(internal.lotoLib.getGame, { game_id: args.game_id })
    if (!game) return { polling: false, reason: 'gone' }
    if (game.winner_ticket_id !== undefined) return { polling: false, reason: 'winner' }
    if (game.channels.length === 0) return { polling: false, reason: 'no-channels' }
    if (Date.now() - game.created_at > LOTO_TTL_MS) return { polling: false, reason: 'expired' }

    const ticketSize = args.ticket_size ?? DEFAULT_TICKET_SIZE
    const maxNumber = args.max_number ?? DEFAULT_MAX_NUMBER
    const { synced } = await pollOnce(ctx, {
      game_id: args.game_id,
      ticketSize,
      maxNumber,
    })

    // A winner may have been reported while this tick was polling.
    const fresh = await ctx.runQuery(internal.lotoLib.getGame, { game_id: args.game_id })
    if (!fresh || fresh.winner_ticket_id !== undefined) {
      return { polling: false, reason: 'winner', synced }
    }
    await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.loto.pollTick, {
      game_id: args.game_id,
      ticket_size: args.ticket_size,
      max_number: args.max_number,
    })
    return { polling: true, synced }
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
// e.g. after the winning ticket is deleted — polling then resumes).
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

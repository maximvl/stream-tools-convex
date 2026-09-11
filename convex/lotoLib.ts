import type { Doc } from './_generated/dataModel'
import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

// Tickets/games older than this are evicted by cron; the polling worker
// also stops past this age so abandoned games can't poll forever.
export const LOTO_TTL_MS = 24 * 60 * 60 * 1000

export type FrontendTicket = {
  id: string
  owner_id: string
  owner_name: string
  value: string[]
  color: string
  variant: number
  type: 'chat' | 'points'
  source: { server: string; channel: string }
  created_at: number
  isLatecomer: boolean
}

export function toFrontendTicket(row: Doc<'loto_tickets'>): FrontendTicket {
  return {
    id: row._id,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    value: row.value,
    color: row.color,
    variant: row.variant,
    type: row.type,
    source: { server: row.source_server, channel: row.source_channel },
    created_at: row.created_at,
    isLatecomer: row.isLatecomer,
  }
}

// Synthetic owner id for streamer tickets (generated or written by the
// channel owner in chat). Sharing one id means a later `+лото` message
// from the streamer upserts the generated ticket instead of duplicating it.
// NOTE: streamer chat tickets created before this scheme carry real
// platform ids and won't merge — they age out via the 24h eviction.
export function streamerOwnerId(server: string, channel: string): string {
  return `streamer/${server}/${channel.toLowerCase()}`
}

// Internal helpers used by the `sync` action (avoids circular imports,
// same split as auth.ts/authLib.ts and rpsAuth.ts/rpsLib.ts).
export const getGame = internalQuery({
  args: { game_id: v.id('loto_games') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.game_id)
  },
})

export const ticketValidator = v.object({
  owner_id: v.string(),
  owner_name: v.string(),
  value: v.array(v.string()),
  type: v.union(v.literal('chat'), v.literal('points')),
  source_server: v.string(),
  source_channel: v.string(),
  created_at: v.number(),
})

export const saveBatch = internalMutation({
  args: { game_id: v.id('loto_games'), tickets: v.array(ticketValidator) },
  handler: async (ctx, args) => {
    for (const t of args.tickets) {
      const existing = await ctx.db
        .query('loto_tickets')
        .withIndex('by_game_owner', (q) => q.eq('game_id', args.game_id).eq('owner_id', t.owner_id))
        .unique()
      if (existing) {
        await ctx.db.patch(existing._id, {
          owner_name: t.owner_name,
          value: t.value,
          type: t.type,
          source_server: t.source_server,
          source_channel: t.source_channel,
          created_at: t.created_at,
        })
      } else {
        await ctx.db.insert('loto_tickets', {
          game_id: args.game_id,
          owner_id: t.owner_id,
          owner_name: t.owner_name,
          value: t.value,
          color: 'random',
          variant: 1,
          type: t.type,
          source_server: t.source_server,
          source_channel: t.source_channel,
          created_at: t.created_at,
          isLatecomer: false,
        })
      }
    }
    return { saved: args.tickets.length }
  },
})

export const touchSeen = internalMutation({
  args: { game_id: v.id('loto_games'), last_seen_ts: v.number() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.game_id)
    if (!game) return null
    if (args.last_seen_ts > game.last_seen_ts) {
      await ctx.db.patch(args.game_id, { last_seen_ts: args.last_seen_ts })
    }
    return { last_seen_ts: Math.max(game.last_seen_ts, args.last_seen_ts) }
  },
})

export const listTickets = internalQuery({
  args: { game_id: v.id('loto_games') },
  handler: async (ctx, args): Promise<FrontendTicket[]> => {
    const tickets = await ctx.db
      .query('loto_tickets')
      .withIndex('by_game', (q) => q.eq('game_id', args.game_id))
      .collect()
    return tickets.sort((a, b) => b.created_at - a.created_at).map((t) => toFrontendTicket(t))
  },
})

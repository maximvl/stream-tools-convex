import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import { LOTO_BAN_TTL_MS } from './lotoLib'

export type FrontendBan = {
  display_name: string
  display_name_lower: string
  stream_channel: string
  source_server: string
  source_channel: string
  created_at: number
  expires_at: number
}

function normalizeChannel(raw: string): string {
  return raw.toLowerCase()
}

// Ban the owner of a ticket: creates/refreshes a
// (channel_lower, display_name_lower) row with a 7-day expiry,
// then deletes the ticket. Only the game owner (owner session) may ban.
export const banUser = mutation({
  args: { ticket_id: v.id('loto_tickets'), session_id: v.string() },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticket_id)
    if (!ticket) throw new Error('Ticket not found')
    const game = await ctx.db.get(ticket.game_id)
    if (!game || game.owner_session_id !== args.session_id) throw new Error('Not the game owner')

    const source_server = ticket.source_server
    const source_channel = ticket.source_channel
    const stream_channel = `${source_server}/${source_channel}`
    const channel_lower = normalizeChannel(stream_channel)
    const display_name = ticket.owner_name
    const display_name_lower = display_name.toLowerCase()
    const now = Date.now()

    const existing = await ctx.db
      .query('loto_bans')
      .withIndex('by_channel_user', (q) =>
        q.eq('channel_lower', channel_lower).eq('display_name_lower', display_name_lower),
      )
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        display_name,
        stream_channel,
        source_server,
        source_channel,
        created_at: now,
        expires_at: now + LOTO_BAN_TTL_MS,
        banned_by_session: args.session_id,
      })
    } else {
      await ctx.db.insert('loto_bans', {
        display_name,
        display_name_lower,
        stream_channel,
        channel_lower,
        source_server,
        source_channel,
        created_at: now,
        expires_at: now + LOTO_BAN_TTL_MS,
        banned_by_session: args.session_id,
      })
    }
    await ctx.db.delete(args.ticket_id)
    return { banned: display_name, stream_channel, deleted: args.ticket_id }
  },
})

// Active (non-expired) bans for the given channels.
// Channels may arrive in any case; matching is case-insensitive.
export const listBans = query({
  args: { channels: v.array(v.string()) },
  handler: async (ctx, args): Promise<{ bans: FrontendBan[] }> => {
    const now = Date.now()
    const wanted = new Set(args.channels.map(normalizeChannel))
    if (wanted.size === 0) return { bans: [] }
    // Small table: full scan + filter is fine and avoids one query per channel.
    const rows = await ctx.db.query('loto_bans').collect()
    return {
      bans: rows
        .filter((r) => r.expires_at > now && wanted.has(r.channel_lower))
        .map((r) => ({
          display_name: r.display_name,
          display_name_lower: r.display_name_lower,
          stream_channel: r.stream_channel,
          source_server: r.source_server,
          source_channel: r.source_channel,
          created_at: r.created_at,
          expires_at: r.expires_at,
        })),
    }
  },
})

// Shared guard used by loto.addTicket / loto.addStreamerTicket.
export async function isBanned(
  ctx: QueryCtx | MutationCtx,
  source_server: string,
  source_channel: string,
  display_name: string,
): Promise<boolean> {
  const channel_lower = normalizeChannel(`${source_server}/${source_channel}`)
  const display_name_lower = display_name.toLowerCase()
  const row = await ctx.db
    .query('loto_bans')
    .withIndex('by_channel_user', (q) =>
      q.eq('channel_lower', channel_lower).eq('display_name_lower', display_name_lower),
    )
    .unique()
  return row !== null && row.expires_at > Date.now()
}

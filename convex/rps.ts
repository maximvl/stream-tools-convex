import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { streamChannelFor } from './userIdentity'

const ROUND_SECONDS = 10

// Creates a tournament from a bare owner session id. The session owns one or
// more stream channels (one `user_auth` row per channel sharing the session).
// No title is stored — clients derive it from `stream_channels`.
export const create = mutation({
  args: { owner_session_id: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('user_auth')
      .withIndex('by_session', (q) => q.eq('session_id', args.owner_session_id))
      .collect()
    if (rows.length === 0)
      throw new Error('No authenticated stream channel for this session')
    const sorted = [...rows].sort((a, b) => b.updated_at - a.updated_at)
    const id = await ctx.db.insert('rps_tournaments', {
      stream_channels: sorted.map((r) => streamChannelFor(r.platform, r.user_slug)),
      owner_session_id: args.owner_session_id,
      status: 'registration',
      current_round: 0,
      round_seconds: ROUND_SECONDS,
      created_at: Date.now(),
    })
    return { id }
  },
})

// Public lobby list: registration + running tournaments, newest first.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const [registration, running] = await Promise.all([
      ctx.db
        .query('rps_tournaments')
        .withIndex('by_status', (q) => q.eq('status', 'registration'))
        .collect(),
      ctx.db
        .query('rps_tournaments')
        .withIndex('by_status', (q) => q.eq('status', 'running'))
        .collect(),
    ])
    return [...registration, ...running]
      .sort((a, b) => b.created_at - a.created_at)
      .map((t) => ({
        id: t._id,
        stream_channels: t.stream_channels,
        status: t.status,
        current_round: t.current_round,
        created_at: t.created_at,
      }))
  },
})

// Public tournament detail (no auth needed to observe).
export const get = query({
  args: { id: v.id('rps_tournaments') },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.id)
    if (!t) return null
    return {
      id: t._id,
      stream_channels: t.stream_channels,
      status: t.status,
      current_round: t.current_round,
      round_seconds: t.round_seconds,
      winner_participant_id: t.winner_participant_id,
      created_at: t.created_at,
      started_at: t.started_at,
      finished_at: t.finished_at,
    }
  },
})

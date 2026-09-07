import { query, internalQuery, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { parseIdentity, cacheKeyFor, streamChannelFor } from './userIdentity'

// Internal helpers used by the `confirm` action (avoids circular imports).
export const getKey = internalQuery({
  args: { stream_channel: v.string(), session_id: v.string() },
  handler: async (ctx, args) => {
    const { platform, user_slug } = parseIdentity(args.stream_channel)
    const row = await ctx.db
      .query('auth_keys')
      .withIndex('by_cache_key', (q) =>
        q.eq('cache_key', cacheKeyFor(platform, user_slug, args.session_id)),
      )
      .unique()
    if (!row || row.expires_at <= Date.now()) return null
    return { auth_key: row.auth_key }
  },
})

export const upsertSession = internalMutation({
  args: { stream_channel: v.string(), session_id: v.string() },
  handler: async (ctx, args) => {
    const { platform, user_slug } = parseIdentity(args.stream_channel)
    const existing = await ctx.db
      .query('user_auth')
      .withIndex('by_user', (q) => q.eq('platform', platform).eq('user_slug', user_slug))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        session_id: args.session_id,
        updated_at: Date.now(),
      })
    } else {
      await ctx.db.insert('user_auth', {
        user_slug,
        platform,
        session_id: args.session_id,
        updated_at: Date.now(),
      })
    }
  },
})

export const sessionOwnsChannel = query({
  args: { stream_channel: v.string(), session_id: v.string() },
  handler: async (ctx, args) => {
    try {
      const { platform, user_slug } = parseIdentity(args.stream_channel)
      const saved = await ctx.db
        .query('user_auth')
        .withIndex('by_user', (q) => q.eq('platform', platform).eq('user_slug', user_slug))
        .unique()
      return saved?.session_id === args.session_id
    } catch {
      return false
    }
  },
})

// All stream channels authenticated under one browser-wide session.
// One session owns many channels: `user_auth` holds one row per channel
// sharing the session id.
export const channelsForSession = query({
  args: { session_id: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('user_auth')
      .withIndex('by_session', (q) => q.eq('session_id', args.session_id))
      .collect()
    return rows.map((r) => ({
      stream_channel: streamChannelFor(r.platform, r.user_slug),
      platform: r.platform,
      user_slug: r.user_slug,
      updated_at: r.updated_at,
    }))
  },
})

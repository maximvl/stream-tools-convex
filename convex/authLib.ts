import { query, mutation, internalQuery, internalMutation } from './_generated/server'
import { v } from 'convex/values'

// Internal helpers used by the `confirm` action (avoids circular imports).
export const getKey = internalQuery({
  args: { stream_channel: v.string(), session_id: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('auth_keys')
      .withIndex('by_cache_key', (q) =>
        q.eq('cache_key', `${args.stream_channel}${args.session_id}`),
      )
      .unique()
    if (!row || row.expires_at <= Date.now()) return null
    return { auth_key: row.auth_key }
  },
})

export const upsertSession = internalMutation({
  args: { stream_channel: v.string(), session_id: v.string() },
  handler: async (ctx, args) => {
    const channelLower = args.stream_channel.toLowerCase()
    const existing = await ctx.db
      .query('user_auth')
      .withIndex('by_channel_lower', (q) => q.eq('channel_lower', channelLower))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, {
        session_id: args.session_id,
        updated_at: Date.now(),
      })
    } else {
      await ctx.db.insert('user_auth', {
        stream_channel: args.stream_channel,
        channel_lower: channelLower,
        session_id: args.session_id,
        updated_at: Date.now(),
      })
    }
  },
})

export const sessionOwnsChannel = query({
  args: { stream_channel: v.string(), session_id: v.string() },
  handler: async (ctx, args) => {
    const saved = await ctx.db
      .query('user_auth')
      .withIndex('by_channel_lower', (q) =>
        q.eq('channel_lower', args.stream_channel.toLowerCase()),
      )
      .unique()
    return saved?.session_id === args.session_id
  },
})

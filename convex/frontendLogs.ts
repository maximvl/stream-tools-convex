import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { parseIdentity, streamChannelFor } from './userIdentity'
import { authChannelsForSession } from './authLib'

// POST /api/frontend_logs validation mirrors Handlers.fs:130-138
function validateLogs(logs: string[]): string | null {
  if (!logs || logs.length === 0) return "Missing required field 'logs' (non-empty array)"
  if (logs.some((t) => !t || t.trim().length === 0)) return "'logs' must not contain empty entries"
  if (logs.some((t) => t.trim().length > 10000 || t.length > 10000))
    return "Each 'log_text' must not exceed 10000 characters"
  return null
}

export const create = mutation({
  args: { session_id: v.string(), logs: v.array(v.string()) },
  handler: async (ctx, args) => {
    const err = validateLogs(args.logs)
    if (err) throw new Error(err)
    // TEMP-MIGRATION: helper skips rows not yet converted to (platform, user_slug).
    const owned = await authChannelsForSession(ctx, args.session_id)
    if (owned.length === 0)
      throw new Error('Not authenticated (no stream channel associated with session)')
    const owner = owned.reduce((a, b) => (b.updated_at > a.updated_at ? b : a))
    const streamChannel = streamChannelFor(owner.platform, owner.user_slug)
    const createdAt = Math.floor(Date.now() / 1000)
    for (const logText of args.logs) {
      await ctx.db.insert('frontend_logs', {
        stream_channel: streamChannel,
        session_id: args.session_id,
        log_text: logText,
        created_at: createdAt,
      })
    }
  },
})

// GET /api/frontend_logs
export const list = query({
  args: {
    session_id: v.string(),
    stream_channel: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const channels = await ctx.db
      .query('user_auth')
      .withIndex('by_session', (q) => q.eq('session_id', args.session_id))
      .collect()
    if (channels.length === 0)
      throw new Error('Not authenticated (no stream channel associated with session)')
    const fallback = [...channels].sort((a, b) => b.updated_at - a.updated_at)[0]
    if (!fallback) throw new Error('Not authenticated (no stream channel associated with session)')
    // TEMP-MIGRATION: fall back to the most recent converted row.
    const converted = [...channels]
      .sort((a, b) => b.updated_at - a.updated_at)
      .find((c) => c.platform && c.user_slug)
    const resolved =
      args.stream_channel && args.stream_channel.trim().length > 0
        ? (() => {
            try {
              const identity = parseIdentity(args.stream_channel as string)
              return streamChannelFor(identity.platform, identity.user_slug)
            } catch {
              throw new Error('Not authenticated for this stream channel')
            }
          })()
        : converted
          ? streamChannelFor(converted.platform as string, converted.user_slug as string)
          : null
    if (!resolved) throw new Error('Not authenticated (no stream channel associated with session)')
    let wanted: { platform: string; user_slug: string }
    try {
      wanted = parseIdentity(resolved)
    } catch {
      throw new Error('Not authenticated for this stream channel')
    }
    const owned = channels.some(
      (c) => c.platform === wanted.platform && c.user_slug === wanted.user_slug,
    )
    if (!owned) throw new Error('Not authenticated for this stream channel')
    const limit = args.limit && args.limit > 0 && args.limit <= 1000 ? args.limit : 100
    const logs = await ctx.db
      .query('frontend_logs')
      .withIndex('by_channel', (q) => q.eq('stream_channel', resolved))
      .order('desc')
      .take(limit)
    return {
      logs: logs.map((l) => ({
        id: l._id,
        created_at: l.created_at,
        session_id: l.session_id,
        stream_channel: l.stream_channel,
        log_text: l.log_text,
      })),
    }
  },
})

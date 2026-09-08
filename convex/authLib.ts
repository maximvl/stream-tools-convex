import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  type MutationCtx,
} from './_generated/server'
import { v } from 'convex/values'
import { parseIdentity, cacheKeyFor, streamChannelFor } from './userIdentity'

const SESSION_LEN = 15

function makeSessionId(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

// Mints a bare browser session with no channel attached (e.g. for viewers
// who own no channels yet). Identity is bound later via auth flows.
export const mintSession = mutation({
  args: {},
  handler: async () => {
    return { session_id: makeSessionId(SESSION_LEN) }
  },
})

// Primary channel priority: twitch > kick > vkvideo > wtv.
const PLATFORM_PRIORITY: Record<string, number> = { twitch: 0, kick: 1, vkvideo: 2, wtv: 3 }

export function compareChannelPriority(
  a: { platform: string; user_slug: string },
  b: { platform: string; user_slug: string },
): number {
  return (
    (PLATFORM_PRIORITY[a.platform] ?? 99) - (PLATFORM_PRIORITY[b.platform] ?? 99) ||
    a.user_slug.localeCompare(b.user_slug)
  )
}

export type AuthChannel = {
  platform: 'vkvideo' | 'twitch' | 'kick' | 'wtv'
  user_slug: string
  stream_channel: string
  via_channel: string | undefined
  updated_at: number
}

// All stream channels authenticated under one browser-wide session,
// sorted by platform priority. Sessions are lookup keys only — identity
// lives in user_auth rows.
export async function authChannelsForSession(
  ctx: MutationCtx,
  session_id: string,
): Promise<AuthChannel[]> {
  const rows = await ctx.db
    .query('user_auth')
    .withIndex('by_session', (q) => q.eq('session_id', session_id))
    .collect()
  return rows
    .map((r) => ({
      platform: r.platform,
      user_slug: r.user_slug,
      stream_channel: streamChannelFor(r.platform, r.user_slug),
      via_channel: r.via_channel,
      updated_at: r.updated_at,
    }))
    .sort(compareChannelPriority)
}

// The single representative channel for a session: first by platform
// priority (twitch, kick, vkvideo, wtv).
export async function primaryChannelForSession(
  ctx: MutationCtx,
  session_id: string,
): Promise<AuthChannel | undefined> {
  const channels = await authChannelsForSession(ctx, session_id)
  return channels[0]
}

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
  args: {
    stream_channel: v.string(),
    session_id: v.string(),
    via_channel: v.optional(v.string()),
  },
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
        via_channel: args.via_channel,
      })
    } else {
      await ctx.db.insert('user_auth', {
        user_slug,
        platform,
        session_id: args.session_id,
        updated_at: Date.now(),
        via_channel: args.via_channel,
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
    return rows
      .map((r) => ({
        stream_channel: streamChannelFor(r.platform, r.user_slug),
        platform: r.platform,
        user_slug: r.user_slug,
        via_channel: r.via_channel,
        updated_at: r.updated_at,
      }))
      .sort(compareChannelPriority)
  },
})

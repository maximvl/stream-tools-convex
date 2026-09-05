import { query, mutation, action } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

const SESSION_LEN = 15
const AUTH_KEY_LEN = 5
const AUTH_TTL_MS = 60 * 60 * 1000

function makeId(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function cacheKeyFor(streamChannel: string, sessionId: string): string {
  return `${streamChannel}${sessionId}`
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

// GET /api/auth_check?stream_channel=  (Handlers.fs:12-32)
// Single round trip: verifies the session AND get-or-creates the auth key.
// A mutation (not a query) because creating the key is a write.
// Returns session_id explicitly since Convex cannot set cookies.
export const check = mutation({
  args: { stream_channel: v.string(), session_id: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const channelLower = args.stream_channel.toLowerCase()
    const session_id = args.session_id ?? makeId(SESSION_LEN)
    const saved = await ctx.db
      .query('user_auth')
      .withIndex('by_channel_lower', (q) => q.eq('channel_lower', channelLower))
      .unique()
    if (args.session_id && saved && saved.session_id === args.session_id) {
      return { authenticated: true as const, session_id }
    }
    const cacheKey = cacheKeyFor(args.stream_channel, session_id)
    const now = Date.now()
    const existing = await ctx.db
      .query('auth_keys')
      .withIndex('by_cache_key', (q) => q.eq('cache_key', cacheKey))
      .unique()
    if (existing && existing.expires_at > now) {
      return { authenticated: false as const, auth_key: existing.auth_key, session_id }
    }
    const auth_key = makeId(AUTH_KEY_LEN)
    if (existing) await ctx.db.delete(existing._id)
    await ctx.db.insert('auth_keys', {
      cache_key: cacheKey,
      stream_channel: args.stream_channel,
      session_id,
      auth_key,
      created_at: now,
      expires_at: now + AUTH_TTL_MS,
    })
    return { authenticated: false as const, auth_key, session_id }
  },
})

export const isAuthenticated = query({
  args: { stream_channel: v.string(), session_id: v.string() },
  handler: async (ctx, args) => {
    const saved = await ctx.db
      .query('user_auth')
      .withIndex('by_channel_lower', (q) =>
        q.eq('channel_lower', args.stream_channel.toLowerCase()),
      )
      .unique()
    return { authenticated: saved?.session_id === args.session_id }
  },
})

// POST /api/auth  (Handlers.fs:34-61 + AuthService.fs:33-51)
// Action: verifies chat proof via external chat API, then upserts user_auth.
export const confirm = action({
  args: { stream_channel: v.string(), session_id: v.string() },
  handler: async (ctx, args): Promise<{ authenticated: boolean }> => {
    const keyRow: { auth_key: string } | null = await ctx.runQuery(internal.authLib.getKey, {
      stream_channel: args.stream_channel,
      session_id: args.session_id,
    })
    if (!keyRow) return { authenticated: false }
    const parts = args.stream_channel.split('/')
    if (parts.length < 2) return { authenticated: false }
    const [server, channel] = parts as [string, string]
    const tsFrom = nowSec() - 5 * 60
    const params = new URLSearchParams({ server, channel, tsFrom: String(tsFrom) })
    const res = await fetch(`https://chats.eventlab.dev/api/chat_messages?${params.toString()}`)
    if (!res.ok) return { authenticated: false }
    const data = (await res.json()) as {
      messages: { text: string; user: { displayName: string } }[] | null
    }
    const verified = (data.messages ?? []).some(
      (m) =>
        m.user.displayName.toLowerCase() === channel.toLowerCase() &&
        m.text.includes(keyRow.auth_key),
    )
    if (!verified) return { authenticated: false }
    await ctx.runMutation(internal.authLib.upsertSession, {
      stream_channel: args.stream_channel,
      session_id: args.session_id,
    })
    return { authenticated: true }
  },
})

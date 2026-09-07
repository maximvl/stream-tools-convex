import { internalMutation } from './_generated/server'
import { cacheKeyFor } from './userIdentity'

const PLATFORMS = new Set(['vkvideo', 'twitch', 'kick', 'wtv'])

function parseLegacy(streamChannel: string): { platform: string; user_slug: string } | null {
  const normalized = streamChannel.trim().toLowerCase()
  const sep = normalized.indexOf('/')
  if (sep <= 0 || sep === normalized.length - 1) return null
  const platform = normalized.slice(0, sep)
  const user_slug = normalized.slice(sep + 1)
  if (!PLATFORMS.has(platform) || !user_slug) return null
  return { platform, user_slug }
}

// One-time migration: legacy { stream_channel, channel_lower } rows
// → { user_slug, platform }. Deduplicates on (platform, user_slug),
// keeping the most recently updated row. Safe to re-run.
export const migrateAuthToUserSlugPlatform = internalMutation({
  args: {},
  handler: async (ctx) => {
    let migratedUsers = 0
    let deletedUsers = 0
    let skippedUsers = 0
    const seen = new Map<string, { id: string; updated_at: number }>()

    const users = (await ctx.db.query('user_auth').collect()) as unknown as Record<
      string,
      unknown
    >[]
    for (const raw of users) {
      const doc = raw as {
        _id: string
        user_slug?: unknown
        platform?: unknown
        session_id?: unknown
        updated_at?: unknown
        stream_channel?: unknown
        channel_lower?: unknown
      }
      let platform: string | undefined =
        typeof doc.platform === 'string' ? doc.platform.toLowerCase() : undefined
      let user_slug: string | undefined =
        typeof doc.user_slug === 'string' ? doc.user_slug.toLowerCase() : undefined
      if (!platform || !user_slug || !PLATFORMS.has(platform)) {
        const legacy =
          (typeof doc.stream_channel === 'string' && doc.stream_channel) ||
          (typeof doc.channel_lower === 'string' && doc.channel_lower) ||
          null
        if (!legacy) {
          skippedUsers++
          continue
        }
        const parsed = parseLegacy(legacy)
        if (!parsed) {
          skippedUsers++
          continue
        }
        platform = parsed.platform
        user_slug = parsed.user_slug
      }
      const key = `${platform}/${user_slug}`
      const updatedAt = typeof doc.updated_at === 'number' ? doc.updated_at : 0
      const prev = seen.get(key)
      const patch: Record<string, unknown> = {
        user_slug,
        platform,
        stream_channel: undefined,
        channel_lower: undefined,
      }
      if (!prev) {
        await ctx.db.patch(doc._id as never, patch as never)
        seen.set(key, { id: doc._id, updated_at: updatedAt })
        migratedUsers++
      } else if (updatedAt >= prev.updated_at) {
        // Newer duplicate wins: migrate it, delete the older one.
        await ctx.db.patch(doc._id as never, patch as never)
        await ctx.db.delete(prev.id as never)
        seen.set(key, { id: doc._id, updated_at: updatedAt })
        migratedUsers++
        deletedUsers++
      } else {
        await ctx.db.delete(doc._id as never)
        deletedUsers++
      }
    }

    let migratedKeys = 0
    let deletedKeys = 0
    let skippedKeys = 0
    const seenKeys = new Map<string, { id: string; expires_at: number }>()

    const keys = (await ctx.db.query('auth_keys').collect()) as unknown as Record<string, unknown>[]
    for (const raw of keys) {
      const doc = raw as {
        _id: string
        cache_key?: unknown
        user_slug?: unknown
        platform?: unknown
        session_id?: unknown
        expires_at?: unknown
        stream_channel?: unknown
      }
      let platform: string | undefined =
        typeof doc.platform === 'string' ? doc.platform.toLowerCase() : undefined
      let user_slug: string | undefined =
        typeof doc.user_slug === 'string' ? doc.user_slug.toLowerCase() : undefined
      if (!platform || !user_slug || !PLATFORMS.has(platform)) {
        const legacy =
          typeof doc.stream_channel === 'string' && doc.stream_channel ? doc.stream_channel : null
        if (!legacy) {
          skippedKeys++
          continue
        }
        const parsed = parseLegacy(legacy)
        if (!parsed) {
          skippedKeys++
          continue
        }
        platform = parsed.platform
        user_slug = parsed.user_slug
      }
      const sessionId = typeof doc.session_id === 'string' ? doc.session_id : null
      if (!sessionId) {
        skippedKeys++
        continue
      }
      const cache_key = cacheKeyFor(platform, user_slug, sessionId)
      const expiresAt = typeof doc.expires_at === 'number' ? doc.expires_at : 0
      const prev = seenKeys.get(cache_key)
      const patch: Record<string, unknown> = {
        user_slug,
        platform,
        cache_key,
        stream_channel: undefined,
      }
      if (!prev) {
        await ctx.db.patch(doc._id as never, patch as never)
        seenKeys.set(cache_key, { id: doc._id, expires_at: expiresAt })
        migratedKeys++
      } else if (expiresAt >= prev.expires_at) {
        await ctx.db.patch(doc._id as never, patch as never)
        await ctx.db.delete(prev.id as never)
        seenKeys.set(cache_key, { id: doc._id, expires_at: expiresAt })
        migratedKeys++
        deletedKeys++
      } else {
        await ctx.db.delete(doc._id as never)
        deletedKeys++
      }
    }

    return { migratedUsers, deletedUsers, skippedUsers, migratedKeys, deletedKeys, skippedKeys }
  },
})

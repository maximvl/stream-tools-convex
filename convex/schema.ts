import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const superGameStatus = v.union(v.literal('win'), v.literal('lose'), v.literal('skip'))

export const platform = v.union(
  v.literal('vkvideo'),
  v.literal('twitch'),
  v.literal('kick'),
  v.literal('wtv'),
)

export default defineSchema({
  loto_winners: defineTable({
    username: v.string(),
    super_game_status: superGameStatus,
    created_at: v.number(),
    stream_channel: v.string(),
    channel_lower: v.string(),
    // Legacy column from SQLite, unread by the F# server. Kept so the
    // one-time import loses no data; new writes omit it.
    legacy_session_id: v.optional(v.string()),
  })
    .index('by_channel', ['stream_channel'])
    .index('by_channel_lower', ['channel_lower']),

  user_auth: defineTable({
    user_slug: v.string(),
    platform,
    session_id: v.string(),
    updated_at: v.number(),
  })
    .index('by_user', ['platform', 'user_slug'])
    .index('by_session', ['session_id']),

  auth_keys: defineTable({
    cache_key: v.string(),
    user_slug: v.string(),
    platform,
    session_id: v.string(),
    auth_key: v.string(),
    created_at: v.number(),
    expires_at: v.number(),
  }).index('by_cache_key', ['cache_key']),

  frontend_logs: defineTable({
    stream_channel: v.string(),
    session_id: v.string(),
    log_text: v.string(),
    created_at: v.number(),
  })
    .index('by_channel', ['stream_channel'])
    .index('by_session', ['session_id']),
})

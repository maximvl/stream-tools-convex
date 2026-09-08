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
    // Set when the identity was registered through another stream channel
    // (e.g. an RPS viewer who proved their code in the owner's chat).
    // Undefined for direct self-auth.
    via_channel: v.optional(v.string()),
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

  rps_tournaments: defineTable({
    // Owner identity as stream_channel (`platform/slug`). Sessions are only
    // lookup keys: a new browser re-auths the same channel and resolves back
    // to this identity.
    owner_stream_channel: v.string(),
    stream_channels: v.array(v.string()),
    status: v.union(v.literal('registration'), v.literal('running'), v.literal('finished')),
    current_round: v.number(),
    round_seconds: v.number(),
    winner_participant_id: v.optional(v.id('rps_participants')),
    created_at: v.number(),
    started_at: v.optional(v.number()),
    finished_at: v.optional(v.number()),
  })
    .index('by_status', ['status'])
    .index('by_owner', ['owner_stream_channel']),

  rps_participants: defineTable({
    tournament_id: v.id('rps_tournaments'),
    platform,
    user_slug: v.string(),
    display_name: v.string(),
    via_stream_channel: v.string(),
    // No session stored: identity is (platform, user_slug, via). A session
    // only resolves to identities via user_auth, so a new browser that
    // re-proves the same channel sees the same entries.
    wins: v.number(),
    status: v.union(v.literal('active'), v.literal('eliminated'), v.literal('champion')),
    eliminated_in_round: v.optional(v.number()),
    is_bot: v.boolean(),
    created_at: v.number(),
  })
    .index('by_tournament', ['tournament_id'])
    .index('by_identity', ['tournament_id', 'platform', 'user_slug']),

  rps_matches: defineTable({
    tournament_id: v.id('rps_tournaments'),
    round: v.number(),
    a_id: v.id('rps_participants'),
    b_id: v.id('rps_participants'),
    move_a: v.optional(v.union(v.literal('rock'), v.literal('paper'), v.literal('scissors'))),
    move_b: v.optional(v.union(v.literal('rock'), v.literal('paper'), v.literal('scissors'))),
    status: v.union(v.literal('pending'), v.literal('resolved')),
    winner_id: v.optional(v.id('rps_participants')),
    is_draw: v.optional(v.boolean()),
    deadline_at: v.number(),
    resolved_at: v.optional(v.number()),
    created_at: v.number(),
  })
    .index('by_tournament_round', ['tournament_id', 'round'])
    .index('by_tournament', ['tournament_id']),

  rps_codes: defineTable({
    tournament_id: v.id('rps_tournaments'),
    viewer_session_id: v.string(),
    auth_key: v.string(),
    proofs: v.array(
      v.object({
        via_stream_channel: v.string(),
        platform,
        user_slug: v.string(),
        display_name: v.string(),
      }),
    ),
    created_at: v.number(),
    expires_at: v.number(),
  }).index('by_lookup', ['tournament_id', 'viewer_session_id']),
})

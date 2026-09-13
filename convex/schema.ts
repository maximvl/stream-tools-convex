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

  // TEMP-MIGRATION: legacy `stream_channel`/`channel_lower` fields and optional
  // `user_slug`/`platform` allow pre-migration rows to coexist until the
  // one-time backfill completes. Tighten (remove legacy, re-require new)
  // once prod data is converted. See convex/migrateTemp.ts.
  user_auth: defineTable({
    user_slug: v.optional(v.string()),
    platform: v.optional(platform),
    session_id: v.string(),
    updated_at: v.number(),
    // Set when the identity was registered through another stream channel
    // (e.g. an RPS viewer who proved their code in the owner's chat).
    // Undefined for direct self-auth.
    via_channel: v.optional(v.string()),
    stream_channel: v.optional(v.string()),
    channel_lower: v.optional(v.string()),
  })
    .index('by_user', ['platform', 'user_slug'])
    .index('by_session', ['session_id']),

  // TEMP-MIGRATION: same loosening as user_auth above.
  auth_keys: defineTable({
    cache_key: v.string(),
    user_slug: v.optional(v.string()),
    platform: v.optional(platform),
    session_id: v.string(),
    auth_key: v.string(),
    created_at: v.number(),
    expires_at: v.number(),
    stream_channel: v.optional(v.string()),
  })
    .index('by_cache_key', ['cache_key'])
    .index('by_session', ['session_id']),

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

  // Loto instances. One game spans multiple stream channels; ownership is
  // the browser session (which links to all channels via user_auth).
  // game_id is the instance id: ticket queries filter by it so a new game
  // never shows old tickets.
  loto_games: defineTable({
    owner_session_id: v.string(),
    channels: v.array(v.string()),
    created_at: v.number(),
    // Source of truth for rolled numbers (browser picks, backend stores).
    drawn_numbers: v.array(v.string()),
    // Set by the frontend winner watcher; frontend ticket creation stops
    // while set.
    winner_ticket_id: v.optional(v.id('loto_tickets')),
    // Cumulative tickets ever added to this game (upserts and re-rolls don't
    // double-count). Never decremented — survives ticket eviction so totals
    // stay visible as stats. Optional: games created before this field
    // existed read as 0.
    tickets_amount: v.optional(v.number()),
  }).index('by_session', ['owner_session_id']),

  // Temporary tickets for the active game. Evicted by cron after 24h.
  loto_tickets: defineTable({
    game_id: v.id('loto_games'),
    owner_id: v.string(),
    owner_name: v.string(),
    value: v.array(v.string()),
    color: v.string(),
    variant: v.number(),
    type: v.union(v.literal('chat'), v.literal('points')),
    source_server: v.string(),
    source_channel: v.string(),
    created_at: v.number(),
    isLatecomer: v.boolean(),
  })
    .index('by_game', ['game_id'])
    .index('by_game_owner', ['game_id', 'owner_id'])
    .index('by_created', ['created_at']),
})

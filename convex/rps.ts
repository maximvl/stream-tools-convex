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
    if (rows.length === 0) throw new Error('No authenticated stream channel for this session')
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

// Public participant roster for the streamer registration grid.
export const participants = query({
  args: { tournament_id: v.id('rps_tournaments') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('rps_participants')
      .withIndex('by_tournament', (q) => q.eq('tournament_id', args.tournament_id))
      .collect()
    return rows
      .sort((a, b) => a.created_at - b.created_at)
      .map((p) => ({
        id: p._id,
        platform: p.platform,
        user_slug: p.user_slug,
        display_name: p.display_name,
        via_stream_channel: p.via_stream_channel,
        wins: p.wins,
        status: p.status,
        eliminated_in_round: p.eliminated_in_round,
        is_bot: p.is_bot,
      }))
  },
})

// Entries belonging to one viewer session — the viewer page renders one
// board per entry (multi-entry when the code went into several chats).
export const myEntries = query({
  args: { tournament_id: v.id('rps_tournaments'), viewer_session_id: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('rps_participants')
      .withIndex('by_viewer_session', (q) =>
        q.eq('tournament_id', args.tournament_id).eq('viewer_session_id', args.viewer_session_id),
      )
      .collect()
    return rows.map((p) => ({
      id: p._id,
      platform: p.platform,
      user_slug: p.user_slug,
      display_name: p.display_name,
      via_stream_channel: p.via_stream_channel,
      wins: p.wins,
      status: p.status,
      eliminated_in_round: p.eliminated_in_round,
      is_bot: p.is_bot,
    }))
  },
})

// Registration needs only (tournament_id, viewer_session_id): entries are
// created from the stored chat proofs, one per proof (multi-entry).
export const join = mutation({
  args: { tournament_id: v.id('rps_tournaments'), viewer_session_id: v.string() },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.tournament_id)
    if (!t) throw new Error('Tournament not found')
    if (t.status !== 'registration') throw new Error('Registration is closed')
    const code = await ctx.db
      .query('rps_codes')
      .withIndex('by_lookup', (q) =>
        q.eq('tournament_id', args.tournament_id).eq('viewer_session_id', args.viewer_session_id),
      )
      .unique()
    if (!code || code.expires_at <= Date.now()) throw new Error('Code expired, request a new one')
    if (code.proofs.length === 0) throw new Error('Confirm your code in chat first')
    const existing = await ctx.db
      .query('rps_participants')
      .withIndex('by_tournament', (q) => q.eq('tournament_id', args.tournament_id))
      .collect()
    const seen = new Set(
      existing.map((e) => `${e.platform}|${e.user_slug}|${e.via_stream_channel}`),
    )
    const out: { id: unknown; display_name: string; via_stream_channel: string }[] = []
    for (const p of code.proofs) {
      const key = `${p.platform}|${p.user_slug}|${p.via_stream_channel}`
      const dup = existing.find(
        (e) =>
          e.platform === p.platform &&
          e.user_slug === p.user_slug &&
          e.via_stream_channel === p.via_stream_channel,
      )
      if (dup || seen.has(key)) {
        if (dup)
          out.push({
            id: dup._id,
            display_name: dup.display_name,
            via_stream_channel: dup.via_stream_channel,
          })
        continue
      }
      seen.add(key)
      const id = await ctx.db.insert('rps_participants', {
        tournament_id: args.tournament_id,
        platform: p.platform,
        user_slug: p.user_slug,
        display_name: p.display_name,
        via_stream_channel: p.via_stream_channel,
        viewer_session_id: args.viewer_session_id,
        wins: 0,
        status: 'active',
        is_bot: false,
        created_at: Date.now(),
      })
      out.push({ id, display_name: p.display_name, via_stream_channel: p.via_stream_channel })
    }
    return { participants: out }
  },
})

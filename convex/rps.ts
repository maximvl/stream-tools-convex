import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { requireOwner } from './rpsLib'
import { authChannelsForSession, compareChannelPriority, primaryChannelForSession } from './authLib'
import { parseIdentity, streamChannelFor } from './userIdentity'

const ROUND_SECONDS = 10

// Creates a tournament from a bare owner session id: the session is only
// used to fetch the owner's stream channels; the stored owner reference is
// the primary channel identity. No title is stored — clients derive it from
// `stream_channels`.
export const create = mutation({
  args: { owner_session_id: v.string() },
  handler: async (ctx, args) => {
    const primary = await primaryChannelForSession(ctx, args.owner_session_id)
    if (!primary) throw new Error('No authenticated stream channel for this session')
    const channels = await authChannelsForSession(ctx, args.owner_session_id)
    const id = await ctx.db.insert('rps_tournaments', {
      owner_stream_channel: primary.stream_channel,
      stream_channels: channels.map((c) => c.stream_channel),
      status: 'registration',
      current_round: 0,
      round_seconds: ROUND_SECONDS,
      created_at: Date.now(),
    })
    return { id, owner_stream_channel: primary.stream_channel }
  },
})

// Owner starts the tournament after registration. Rounds then run
// automatically until a winner is found — the streamer only observes.
export const start = mutation({
  args: { tournament_id: v.id('rps_tournaments'), owner_session_id: v.string() },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.tournament_id)
    if (!t) throw new Error('Tournament not found')
    if (t.status !== 'registration') throw new Error('Tournament already started')
    await requireOwner(ctx, t, args.owner_session_id)
    const actives = await ctx.db
      .query('rps_participants')
      .withIndex('by_tournament', (q) => q.eq('tournament_id', args.tournament_id))
      .collect()
    if (actives.filter((p) => p.status === 'active').length < 1) throw new Error('No participants')
    await ctx.db.patch(args.tournament_id, {
      status: 'running',
      started_at: Date.now(),
      current_round: 1,
    })
    await ctx.runMutation(internal.rpsMatches.makeRound, { tournament_id: args.tournament_id })
    return { round: 1 }
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
        owner_stream_channel: t.owner_stream_channel,
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
    const winner = t.winner_participant_id ? await ctx.db.get(t.winner_participant_id) : null
    return {
      id: t._id,
      owner_stream_channel: t.owner_stream_channel,
      stream_channels: t.stream_channels,
      status: t.status,
      current_round: t.current_round,
      round_seconds: t.round_seconds,
      winner_participant_id: t.winner_participant_id,
      winner_display_name: winner?.display_name,
      created_at: t.created_at,
      started_at: t.started_at,
      finished_at: t.finished_at,
    }
  },
})

// Channel-keyed lookup for the frontend route: the page id is the bare
// streamer channel name (`/rps/foo`). If several platforms share the slug,
// platform priority wins (twitch, kick, vkvideo, wtv); then registration is
// preferred over running over finished, then newest. Finished tournaments
// stay visible so the final screen persists until the next one starts.
export const getByOwnerChannel = query({
  args: { channel: v.string() },
  handler: async (ctx, args) => {
    const slug = args.channel.trim().toLowerCase()
    if (!slug) return null
    const [registration, running, finished] = await Promise.all([
      ctx.db
        .query('rps_tournaments')
        .withIndex('by_status', (q) => q.eq('status', 'registration'))
        .collect(),
      ctx.db
        .query('rps_tournaments')
        .withIndex('by_status', (q) => q.eq('status', 'running'))
        .collect(),
      ctx.db
        .query('rps_tournaments')
        .withIndex('by_status', (q) => q.eq('status', 'finished'))
        .collect(),
    ])
    const live = [...registration, ...running, ...finished].filter((t) => {
      const sep = t.owner_stream_channel.indexOf('/')
      return sep >= 0 && t.owner_stream_channel.slice(sep + 1) === slug
    })
    if (live.length === 0) return null
    const statusRank = { registration: 0, running: 1, finished: 2 } as const
    const identityOf = (owner: string) => {
      try {
        const identity = parseIdentity(owner)
        return { platform: identity.platform, user_slug: identity.user_slug }
      } catch {
        return { platform: '', user_slug: '' }
      }
    }
    live.sort((a, b) => {
      const pri = compareChannelPriority(
        identityOf(a.owner_stream_channel),
        identityOf(b.owner_stream_channel),
      )
      if (pri !== 0) return pri
      if (a.status !== b.status) return statusRank[a.status] - statusRank[b.status]
      return b.created_at - a.created_at
    })
    const t = live[0]
    if (!t) return null
    const winner = t.winner_participant_id ? await ctx.db.get(t.winner_participant_id) : null
    return {
      id: t._id,
      owner_stream_channel: t.owner_stream_channel,
      stream_channels: t.stream_channels,
      status: t.status,
      current_round: t.current_round,
      round_seconds: t.round_seconds,
      winner_participant_id: t.winner_participant_id,
      winner_display_name: winner?.display_name,
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

// Entries for the caller's identities: the session resolves to
// (platform, slug) identities via user_auth, and entries are matched by
// identity — so a new browser that re-proves the same channel sees the same
// boards. One board per entry (multi-entry when the code went into several
// chats).
export const myEntries = query({
  args: { tournament_id: v.id('rps_tournaments'), viewer_session_id: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('user_auth')
      .withIndex('by_session', (q) => q.eq('session_id', args.viewer_session_id))
      .collect()
    if (rows.length === 0) return []
    const owned = new Set(rows.map((r) => `${r.platform}|${r.user_slug}`))
    const participants = await ctx.db
      .query('rps_participants')
      .withIndex('by_tournament', (q) => q.eq('tournament_id', args.tournament_id))
      .collect()
    return participants
      .filter((p) => owned.has(`${p.platform}|${p.user_slug}`))
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

// Registration needs only (tournament_id, viewer_session_id): entries are
// created from the stored chat proofs, one per proof (multi-entry). If the
// session already has auth (user_auth rows — e.g. returning viewer or authed
// elsewhere), identities join directly without any code: via reuses the
// identity's own channel when it belongs to this tournament, else the
// tournament's primary channel.
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
    const codeLive = code && code.expires_at > Date.now() ? code : null
    const candidates: {
      platform: 'vkvideo' | 'twitch' | 'kick' | 'wtv'
      user_slug: string
      display_name: string
      via_stream_channel: string
    }[] = (codeLive?.proofs ?? []).map((p) => ({
      platform: p.platform,
      user_slug: p.user_slug,
      display_name: p.display_name,
      via_stream_channel: p.via_stream_channel,
    }))
    const covered = new Set(candidates.map((c) => `${c.platform}|${c.user_slug}`))
    const identities = await ctx.db
      .query('user_auth')
      .withIndex('by_session', (q) => q.eq('session_id', args.viewer_session_id))
      .collect()
    for (const ident of identities) {
      const key = `${ident.platform}|${ident.user_slug}`
      if (covered.has(key)) continue
      covered.add(key)
      const via =
        ident.via_channel && t.stream_channels.includes(ident.via_channel)
          ? ident.via_channel
          : t.stream_channels[0]
      if (!via) continue
      candidates.push({
        platform: ident.platform,
        user_slug: ident.user_slug,
        display_name: ident.user_slug,
        via_stream_channel: via,
      })
    }
    if (candidates.length === 0) {
      if (code && !codeLive) throw new Error('Code expired, request a new one')
      throw new Error('Confirm your code in chat first')
    }
    const existing = await ctx.db
      .query('rps_participants')
      .withIndex('by_tournament', (q) => q.eq('tournament_id', args.tournament_id))
      .collect()
    const seen = new Set(
      existing.map((e) => `${e.platform}|${e.user_slug}|${e.via_stream_channel}`),
    )
    const out: { id: unknown; display_name: string; via_stream_channel: string }[] = []
    for (const p of candidates) {
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

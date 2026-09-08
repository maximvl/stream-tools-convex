import { internalMutation, mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { moveValidator, randomMove, rpsOutcome, shuffle, type Move } from './rpsLib'
import { parseIdentity } from './userIdentity'

const ADVANCE_DELAY_MS = 3000

// Swiss-style pairing within equal-wins groups, high wins first; leftovers
// pair down into the next group; the final odd player faces a bot
// gatekeeper (random move, never advances).
export const makeRound = internalMutation({
  args: { tournament_id: v.id('rps_tournaments') },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.tournament_id)
    if (!t || t.status !== 'running') return { created: 0 }
    const round = t.current_round
    const all = await ctx.db
      .query('rps_participants')
      .withIndex('by_tournament', (q) => q.eq('tournament_id', args.tournament_id))
      .collect()
    const humans = shuffle(all.filter((p) => p.status === 'active' && !p.is_bot))
    const groups = new Map<number, typeof humans>()
    for (const h of humans) {
      const g = groups.get(h.wins) ?? []
      g.push(h)
      groups.set(h.wins, g)
    }
    const ordered = [...groups.entries()].sort((a, b) => b[0] - a[0])
    type Rower = (typeof humans)[number]
    const pairs: [Rower, Rower][] = []
    let carry: Rower | null = null
    for (const [, members] of ordered) {
      const list: Rower[] = carry ? [carry, ...shuffle(members)] : shuffle(members)
      carry = null
      for (let i = 0; i + 1 < list.length; i += 2) {
        const first = list[i]
        const second = list[i + 1]
        if (first && second) pairs.push([first, second])
      }
      if (list.length % 2 === 1) carry = list[list.length - 1] ?? null
    }
    if (carry) {
      const ownerPlatform = (() => {
        try {
          return parseIdentity(t.stream_channels[0] ?? t.owner_stream_channel).platform
        } catch {
          return 'twitch' as const
        }
      })()
      const botId = await ctx.db.insert('rps_participants', {
        tournament_id: args.tournament_id,
        platform: ownerPlatform,
        user_slug: `bot-r${round}-${Math.floor(Math.random() * 1e6)}`,
        display_name: 'BOT',
        via_stream_channel: t.stream_channels[0] ?? t.owner_stream_channel,
        wins: carry.wins,
        status: 'active',
        is_bot: true,
        created_at: Date.now(),
      })
      const bot = await ctx.db.get(botId)
      if (bot) pairs.push([carry, bot])
    }
    const now = Date.now()
    let created = 0
    for (const [a, b] of pairs) {
      const deadline_at = now + t.round_seconds * 1000
      // Bot moves are rolled at creation: a bot match then concludes the
      // moment the human picks (both moves present triggers resolve).
      const matchId = await ctx.db.insert('rps_matches', {
        tournament_id: args.tournament_id,
        round,
        a_id: a._id,
        b_id: b._id,
        status: 'pending',
        deadline_at,
        created_at: now,
        ...(a.is_bot ? { move_a: randomMove() } : b.is_bot ? { move_b: randomMove() } : {}),
      })
      await ctx.scheduler.runAt(deadline_at, internal.rpsMatches.resolveMatch, {
        match_id: matchId,
      })
      created++
    }
    return { created, round }
  },
})

// Player submits rock/paper/scissors. Opponent moves stay hidden until the
// match resolves (see myMatches/matchesForRound).
export const submitMove = mutation({
  args: {
    match_id: v.id('rps_matches'),
    participant_id: v.id('rps_participants'),
    move: moveValidator,
    viewer_session_id: v.string(),
  },
  handler: async (ctx, args) => {
    const m = await ctx.db.get(args.match_id)
    if (!m) throw new Error('Match not found')
    if (m.status !== 'pending') throw new Error('Match already resolved')
    if (Date.now() > m.deadline_at) throw new Error('Round closed')
    const p = await ctx.db.get(args.participant_id)
    if (!p) throw new Error('Participant not found')
    if (p.is_bot) throw new Error('Bots move on their own')
    if (p._id !== m.a_id && p._id !== m.b_id) throw new Error('Not your match')
    const owned = await ctx.db
      .query('user_auth')
      .withIndex('by_session', (q) => q.eq('session_id', args.viewer_session_id))
      .collect()
    if (!owned.some((o) => o.platform === p.platform && o.user_slug === p.user_slug))
      throw new Error('Not your entry')
    await ctx.db.patch(
      args.match_id,
      p._id === m.a_id ? { move_a: args.move } : { move_b: args.move },
    )
    const fresh = await ctx.db.get(args.match_id)
    if (fresh && fresh.status === 'pending' && fresh.move_a && fresh.move_b) {
      await ctx.runMutation(internal.rpsMatches.resolveMatch, { match_id: args.match_id })
    }
    return { ok: true as const }
  },
})

// Resolves a match: decisive wins, draws replay automatically, no-shows
// forfeit, bots never advance. Idempotent — safe to call from both the
// second submitMove and the scheduled deadline.
export const resolveMatch = internalMutation({
  args: { match_id: v.id('rps_matches') },
  handler: async (ctx, args) => {
    const m = await ctx.db.get(args.match_id)
    if (!m || m.status !== 'pending') return { status: 'noop' as const }
    const t = await ctx.db.get(m.tournament_id)
    if (!t || t.status !== 'running') return { status: 'noop' as const }
    const pa = await ctx.db.get(m.a_id)
    const pb = await ctx.db.get(m.b_id)
    if (!pa || !pb) return { status: 'noop' as const }
    const now = Date.now()
    const ma: Move | undefined = m.move_a ?? (pa.is_bot ? randomMove() : undefined)
    const mb: Move | undefined = m.move_b ?? (pb.is_bot ? randomMove() : undefined)
    if (m.move_a === undefined && pa.is_bot) await ctx.db.patch(m._id, { move_a: ma })
    if (m.move_b === undefined && pb.is_bot) await ctx.db.patch(m._id, { move_b: mb })

    const eliminate = async (id: typeof pa._id) => {
      await ctx.db.patch(id, { status: 'eliminated', eliminated_in_round: m.round })
    }
    const crownWin = async (id: typeof pa._id) => {
      const winner = await ctx.db.get(id)
      if (winner && !winner.is_bot) await ctx.db.patch(id, { wins: winner.wins + 1 })
    }
    // Winner advances unless it's a bot — then the slot just vanishes.
    const decide = async (winnerId: typeof pa._id, loserId: typeof pa._id) => {
      const winner = await ctx.db.get(winnerId)
      if (winner?.is_bot) {
        await eliminate(loserId)
        await eliminate(winnerId)
      } else {
        await crownWin(winnerId)
        await eliminate(loserId)
      }
    }

    if (!ma && !mb) {
      await eliminate(pa._id)
      await eliminate(pb._id)
      await ctx.db.patch(m._id, { status: 'resolved', resolved_at: now })
    } else if (ma && !mb) {
      await ctx.db.patch(m._id, { status: 'resolved', winner_id: pa._id, resolved_at: now })
      await decide(pa._id, pb._id)
    } else if (!ma && mb) {
      await ctx.db.patch(m._id, { status: 'resolved', winner_id: pb._id, resolved_at: now })
      await decide(pb._id, pa._id)
    } else {
      const outcome = rpsOutcome(ma as Move, mb as Move)
      if (outcome === 'draw') {
        await ctx.db.patch(m._id, { status: 'resolved', is_draw: true, resolved_at: now })
        const deadline_at = now + t.round_seconds * 1000
        const replayId = await ctx.db.insert('rps_matches', {
          tournament_id: m.tournament_id,
          round: m.round,
          a_id: m.a_id,
          b_id: m.b_id,
          status: 'pending',
          deadline_at,
          created_at: now,
          ...(pa.is_bot ? { move_a: randomMove() } : {}),
          ...(pb.is_bot ? { move_b: randomMove() } : {}),
        })
        await ctx.scheduler.runAt(deadline_at, internal.rpsMatches.resolveMatch, {
          match_id: replayId,
        })
      } else if (outcome === 'a') {
        await ctx.db.patch(m._id, { status: 'resolved', winner_id: pa._id, resolved_at: now })
        await decide(pa._id, pb._id)
      } else {
        await ctx.db.patch(m._id, { status: 'resolved', winner_id: pb._id, resolved_at: now })
        await decide(pb._id, pa._id)
      }
    }

    const remaining = await ctx.db
      .query('rps_matches')
      .withIndex('by_tournament_round', (q) =>
        q.eq('tournament_id', m.tournament_id).eq('round', m.round),
      )
      .collect()
    if (remaining.every((r) => r.status === 'resolved')) {
      await ctx.scheduler.runAfter(ADVANCE_DELAY_MS, internal.rpsMatches.advanceRound, {
        tournament_id: m.tournament_id,
      })
    }
    return { status: 'resolved' as const }
  },
})

// Advances the tournament: crowns the last human standing, finishes
// winnerless if nobody remains, else opens the next round automatically.
export const advanceRound = internalMutation({
  args: { tournament_id: v.id('rps_tournaments') },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.tournament_id)
    if (!t || t.status !== 'running') return { status: 'noop' as const }
    const current = await ctx.db
      .query('rps_matches')
      .withIndex('by_tournament_round', (q) =>
        q.eq('tournament_id', args.tournament_id).eq('round', t.current_round),
      )
      .collect()
    if (current.some((r) => r.status !== 'resolved')) return { status: 'waiting' as const }
    const all = await ctx.db
      .query('rps_participants')
      .withIndex('by_tournament', (q) => q.eq('tournament_id', args.tournament_id))
      .collect()
    const actives = all.filter((p) => p.status === 'active' && !p.is_bot)
    if (actives.length === 1 && actives[0]) {
      await ctx.db.patch(actives[0]._id, { status: 'champion' })
      await ctx.db.patch(args.tournament_id, {
        status: 'finished',
        winner_participant_id: actives[0]._id,
        finished_at: Date.now(),
      })
      return { status: 'finished' as const }
    }
    if (actives.length === 0) {
      await ctx.db.patch(args.tournament_id, { status: 'finished', finished_at: Date.now() })
      return { status: 'finished' as const }
    }
    await ctx.db.patch(args.tournament_id, { current_round: t.current_round + 1 })
    await ctx.runMutation(internal.rpsMatches.makeRound, { tournament_id: args.tournament_id })
    return { status: 'advanced' as const }
  },
})

type ParticipantCard = {
  id: Doc<'rps_participants'>['_id']
  platform: Doc<'rps_participants'>['platform']
  user_slug: string
  display_name: string
  via_stream_channel: string
  wins: number
  status: Doc<'rps_participants'>['status']
  is_bot: boolean
}

function toCard(p: Doc<'rps_participants'>): ParticipantCard {
  return {
    id: p._id,
    platform: p.platform,
    user_slug: p.user_slug,
    display_name: p.display_name,
    via_stream_channel: p.via_stream_channel,
    wins: p.wins,
    status: p.status,
    is_bot: p.is_bot,
  }
}

// Public round view for spectators/streamer: opponent moves hidden until
// resolved (anti-counter-pick).
export const matchesForRound = query({
  args: { tournament_id: v.id('rps_tournaments'), round: v.number() },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query('rps_matches')
      .withIndex('by_tournament_round', (q) =>
        q.eq('tournament_id', args.tournament_id).eq('round', args.round),
      )
      .collect()
    const all = await ctx.db
      .query('rps_participants')
      .withIndex('by_tournament', (q) => q.eq('tournament_id', args.tournament_id))
      .collect()
    const byId = new Map(all.map((p) => [p._id, p]))
    return matches
      .sort((a, b) => a.created_at - b.created_at)
      .map((m) => {
        const a = byId.get(m.a_id)
        const b = byId.get(m.b_id)
        const revealed = m.status === 'resolved'
        return {
          id: m._id,
          round: m.round,
          status: m.status,
          winner_id: m.winner_id,
          is_draw: m.is_draw,
          move_a: revealed ? m.move_a : undefined,
          move_b: revealed ? m.move_b : undefined,
          deadline_at: m.deadline_at,
          resolved_at: m.resolved_at,
          a: a ? toCard(a) : null,
          b: b ? toCard(b) : null,
        }
      })
  },
})

// Viewer boards: all my entries' matches across rounds. Own moves always
// visible; opponent moves only after resolution.
export const myMatches = query({
  args: { tournament_id: v.id('rps_tournaments'), viewer_session_id: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('user_auth')
      .withIndex('by_session', (q) => q.eq('session_id', args.viewer_session_id))
      .collect()
    if (rows.length === 0) return []
    const owned = new Set(rows.map((r) => `${r.platform}|${r.user_slug}`))
    const all = await ctx.db
      .query('rps_participants')
      .withIndex('by_tournament', (q) => q.eq('tournament_id', args.tournament_id))
      .collect()
    const mine = all.filter((p) => owned.has(`${p.platform}|${p.user_slug}`))
    const mineIds = new Set(mine.map((p) => p._id))
    const matches = await ctx.db
      .query('rps_matches')
      .withIndex('by_tournament', (q) => q.eq('tournament_id', args.tournament_id))
      .collect()
    const byId = new Map(all.map((p) => [p._id, p]))
    return matches
      .filter((m) => mineIds.has(m.a_id) || mineIds.has(m.b_id))
      .sort((a, b) => a.round - b.round || a.created_at - b.created_at)
      .map((m) => {
        const me = mineIds.has(m.a_id) ? byId.get(m.a_id) : byId.get(m.b_id)
        const opp = mineIds.has(m.a_id) ? byId.get(m.b_id) : byId.get(m.a_id)
        const iAmA = mineIds.has(m.a_id) && me?._id === m.a_id
        const revealed = m.status === 'resolved'
        return {
          id: m._id,
          round: m.round,
          status: m.status,
          winner_id: m.winner_id,
          is_draw: m.is_draw,
          my_move: iAmA ? m.move_a : m.move_b,
          opp_move: revealed ? (iAmA ? m.move_b : m.move_a) : undefined,
          i_won: m.winner_id !== undefined && me?._id === m.winner_id,
          deadline_at: m.deadline_at,
          me: me ? toCard(me) : null,
          opp: opp ? toCard(opp) : null,
        }
      })
  },
})

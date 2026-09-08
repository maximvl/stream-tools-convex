import { internalMutation, internalQuery, type MutationCtx } from './_generated/server'
import { v, type Infer } from 'convex/values'
import { streamChannelFor } from './userIdentity'

export const moveValidator = v.union(v.literal('rock'), v.literal('paper'), v.literal('scissors'))
export type Move = Infer<typeof moveValidator>

export const proofValidator = v.object({
  via_stream_channel: v.string(),
  platform: v.union(v.literal('vkvideo'), v.literal('twitch'), v.literal('kick'), v.literal('wtv')),
  user_slug: v.string(),
  display_name: v.string(),
})

// Internal helpers used by the `confirm` action (avoids circular imports,
// same split as auth.ts/authLib.ts).
export const getCode = internalQuery({
  args: { tournament_id: v.id('rps_tournaments'), viewer_session_id: v.string() },
  handler: async (ctx, args) => {
    const code = await ctx.db
      .query('rps_codes')
      .withIndex('by_lookup', (q) =>
        q.eq('tournament_id', args.tournament_id).eq('viewer_session_id', args.viewer_session_id),
      )
      .unique()
    if (!code) return null
    const t = await ctx.db.get(args.tournament_id)
    if (!t) return null
    return {
      auth_key: code.auth_key,
      expires_at: code.expires_at,
      stream_channels: t.stream_channels,
      proofs: code.proofs,
    }
  },
})

export const saveProofs = internalMutation({
  args: {
    tournament_id: v.id('rps_tournaments'),
    viewer_session_id: v.string(),
    proofs: v.array(proofValidator),
  },
  handler: async (ctx, args) => {
    const code = await ctx.db
      .query('rps_codes')
      .withIndex('by_lookup', (q) =>
        q.eq('tournament_id', args.tournament_id).eq('viewer_session_id', args.viewer_session_id),
      )
      .unique()
    if (!code) return []
    const key = (p: { via_stream_channel: string; platform: string; user_slug: string }) =>
      `${p.via_stream_channel}|${p.platform}|${p.user_slug}`
    const seen = new Set(code.proofs.map(key))
    const merged = [...code.proofs]
    for (const p of args.proofs) {
      if (!seen.has(key(p))) {
        seen.add(key(p))
        merged.push(p)
      }
    }
    if (merged.length !== code.proofs.length) await ctx.db.patch(code._id, { proofs: merged })
    return merged
  },
})

// ---- Match engine shared helpers (used by rps.ts + rpsMatches.ts) ----

// All stream identities (platform/slug pairs) authenticated under a session.
// Sessions are lookup keys only — identity lives in user_auth rows.
export async function identitiesForSession(ctx: MutationCtx, session_id: string) {
  const rows = await ctx.db
    .query('user_auth')
    .withIndex('by_session', (q) => q.eq('session_id', session_id))
    .collect()
  return rows.map((r) => ({
    platform: r.platform,
    user_slug: r.user_slug,
    stream_channel: streamChannelFor(r.platform, r.user_slug),
  }))
}

// Owner gate for owner-only actions (start, cancel): the caller's session
// must resolve to the tournament's owner identity. A new browser that
// re-proves the same channel passes too.
export async function requireOwner(
  ctx: MutationCtx,
  tournament: { owner_stream_channel: string },
  session_id: string,
): Promise<void> {
  const owned = await identitiesForSession(ctx, session_id)
  if (!owned.some((o) => o.stream_channel === tournament.owner_stream_channel))
    throw new Error('Not the tournament owner')
}

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const bytes = crypto.getRandomValues(new Uint8Array(4))
    const rand = new DataView(bytes.buffer).getUint32(0, false) / 0x100000000
    const j = Math.floor(rand * (i + 1))
    const a = arr[i] as T
    const b = arr[j] as T
    arr[i] = b
    arr[j] = a
  }
  return arr
}

const MOVES: Move[] = ['rock', 'paper', 'scissors']

export function randomMove(): Move {
  const bytes = crypto.getRandomValues(new Uint8Array(1))
  return MOVES[(bytes[0] as number) % MOVES.length] as Move
}

// 'a' = first move wins, 'b' = second wins, 'draw' = replay.
export function rpsOutcome(a: Move, b: Move): 'a' | 'b' | 'draw' {
  if (a === b) return 'draw'
  if (
    (a === 'rock' && b === 'scissors') ||
    (a === 'scissors' && b === 'paper') ||
    (a === 'paper' && b === 'rock')
  )
    return 'a'
  return 'b'
}

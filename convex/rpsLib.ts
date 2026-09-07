import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'

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

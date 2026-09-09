import { action, mutation } from './_generated/server'
import { v, type Infer } from 'convex/values'
import { internal } from './_generated/api'
import { parseIdentity, streamChannelFor } from './userIdentity'
import { proofValidator } from './rpsLib'

type Proof = Infer<typeof proofValidator>

const AUTH_KEY_LEN = 5
const AUTH_TTL_MS = 60 * 60 * 1000

function makeKey(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

// One code per (tournament, viewer session). The viewer pastes it into any
// of the tournament owner's chats; identity is discovered from chat, so the
// viewer page needs no inputs.
export const requestCode = mutation({
  args: { tournament_id: v.id('rps_tournaments'), viewer_session_id: v.string() },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.tournament_id)
    if (!t) throw new Error('Tournament not found')
    if (t.status === 'finished') throw new Error('Tournament is finished')
    const now = Date.now()
    const existing = await ctx.db
      .query('rps_codes')
      .withIndex('by_lookup', (q) =>
        q.eq('tournament_id', args.tournament_id).eq('viewer_session_id', args.viewer_session_id),
      )
      .unique()
    if (existing && existing.expires_at > now) {
      return { auth_key: existing.auth_key, expires_at: existing.expires_at }
    }
    const auth_key = makeKey(AUTH_KEY_LEN)
    if (existing) await ctx.db.delete(existing._id)
    const expires_at = now + AUTH_TTL_MS
    await ctx.db.insert('rps_codes', {
      tournament_id: args.tournament_id,
      viewer_session_id: args.viewer_session_id,
      auth_key,
      proofs: [],
      created_at: now,
      expires_at,
    })
    return { auth_key, expires_at }
  },
})

type ChatMessagesResponse = {
  messages: { text: string; user: { displayName: string } }[] | null
}

// Scans the tournament owner's chats for the viewer's code. Every sighting
// becomes a proof (via-channel + author identity) and upserts the SAME
// `user_auth` table streamers use — one session, many identities.
export const confirm = action({
  args: { tournament_id: v.id('rps_tournaments'), viewer_session_id: v.string() },
  handler: async (ctx, args): Promise<{ authenticated: boolean; proofs: Proof[] }> => {
    const code = await ctx.runQuery(internal.rpsLib.getCode, {
      tournament_id: args.tournament_id,
      viewer_session_id: args.viewer_session_id,
    })
    if (!code) return { authenticated: false as const, proofs: [] }
    if (code.expires_at <= Date.now()) return { authenticated: false as const, proofs: code.proofs }
    // Eventlab expects tsFrom in milliseconds.
    const tsFrom = Date.now() - 5 * 60 * 1000
    // Fire all chat fetches together — one slow/failed channel must not hold
    // up the rest.
    const scanChannel = async (ownerChannel: string): Promise<Proof[]> => {
      let platform: string
      let channel: string
      try {
        const identity = parseIdentity(ownerChannel)
        platform = identity.platform
        channel = identity.user_slug
      } catch {
        return []
      }
      const params = new URLSearchParams({ server: platform, channel, tsFrom: String(tsFrom) })
      let res: Response
      try {
        res = await fetch(`https://chats.eventlab.dev/api/chat_messages?${params.toString()}`)
      } catch {
        return []
      }
      if (!res.ok) return []
      const data = (await res.json()) as ChatMessagesResponse
      const sightings: Proof[] = []
      for (const m of data.messages ?? []) {
        if (
          typeof m.text === 'string' &&
          m.text.includes(code.auth_key) &&
          typeof m.user?.displayName === 'string' &&
          m.user.displayName.length > 0
        ) {
          sightings.push({
            via_stream_channel: ownerChannel,
            platform: platform as Proof['platform'],
            user_slug: m.user.displayName.toLowerCase(),
            display_name: m.user.displayName,
          })
        }
      }
      return sightings
    }
    const settled: PromiseSettledResult<Proof[]>[] = await Promise.allSettled(
      code.stream_channels.map(scanChannel),
    )
    const found: Proof[] = settled.flatMap((r: PromiseSettledResult<Proof[]>) =>
      r.status === 'fulfilled' ? r.value : [],
    )
    // One user_auth row per distinct author identity, all sharing the
    // viewer's session (reuses the streamer auth storage verbatim).
    const seenIdentity = new Set<string>()
    for (const p of found) {
      const identityKey = `${p.platform}|${p.user_slug}`
      if (seenIdentity.has(identityKey)) continue
      seenIdentity.add(identityKey)
      await ctx.runMutation(internal.authLib.upsertSession, {
        stream_channel: streamChannelFor(p.platform, p.user_slug),
        session_id: args.viewer_session_id,
        via_channel: p.via_stream_channel,
      })
    }
    const proofs = await ctx.runMutation(internal.rpsLib.saveProofs, {
      tournament_id: args.tournament_id,
      viewer_session_id: args.viewer_session_id,
      proofs: found,
    })
    return { authenticated: proofs.length > 0, proofs }
  },
})

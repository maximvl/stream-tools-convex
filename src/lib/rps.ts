// Shared RPS frontend client: browser session handling, display helpers,
// and thin Convex call wrappers (mirrors lotoConvex.ts).
import type { ConvexClient } from 'convex/browser'
import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel.js'
import { getSessionId, setSessionId } from './session'

export type TournamentId = Id<'rps_tournaments'>
export type MatchId = Id<'rps_matches'>
export type ParticipantId = Id<'rps_participants'>
export type RpsMove = 'rock' | 'paper' | 'scissors'

// Single global browser session for streamer and viewers alike.
// Returns the stored one, or mints a bare session via backend (viewers who
// own no channels yet have nothing to bootstrap from).
export function rpsSessionId(): string | undefined {
  return getSessionId()
}

export async function ensureRpsSession(client: ConvexClient): Promise<string> {
  const existing = getSessionId()
  if (existing) return existing
  const res = await client.mutation(api.authLib.mintSession, {})
  setSessionId(res.session_id)
  return res.session_id
}

// Display name derived from the primary (first, priority-sorted) channel.
export function tournamentTitle(streamChannels: string[]): string {
  const first = streamChannels[0] ?? ''
  const sep = first.indexOf('/')
  return sep >= 0 ? first.slice(sep + 1) : first
}

// Route id is the bare streamer channel name: `/rps/foo`.
export function tournamentHref(ownerStreamChannel: string): string {
  const sep = ownerStreamChannel.indexOf('/')
  return `/rps/${sep >= 0 ? ownerStreamChannel.slice(sep + 1) : ownerStreamChannel}`
}

export async function createTournament(
  client: ConvexClient,
): Promise<{ id: TournamentId; owner_stream_channel: string }> {
  const session_id = getSessionId()
  if (!session_id) throw new Error('Connect a chat first so the backend can mint a session')
  return await client.mutation(api.rps.create, { owner_session_id: session_id })
}

export async function startTournament(
  client: ConvexClient,
  tournament_id: TournamentId,
): Promise<{ round: number }> {
  const session_id = getSessionId()
  if (!session_id) throw new Error('No session yet')
  return await client.mutation(api.rps.start, {
    tournament_id,
    owner_session_id: session_id,
  })
}

export async function requestViewerCode(
  client: ConvexClient,
  tournament_id: TournamentId,
  viewer_session_id: string,
): Promise<{ auth_key: string; expires_at: number }> {
  return await client.mutation(api.rpsAuth.requestCode, { tournament_id, viewer_session_id })
}

export type RpsProof = {
  via_stream_channel: string
  platform: RpsPlatform
  user_slug: string
  display_name: string
}

export async function confirmViewerCode(
  client: ConvexClient,
  tournament_id: TournamentId,
  viewer_session_id: string,
): Promise<{ authenticated: boolean; proofs: RpsProof[] }> {
  return await client.action(api.rpsAuth.confirm, { tournament_id, viewer_session_id })
}

// Polls confirm until the code is spotted in chat (or attempts run out).
export async function confirmViewerCodeWithRetry(
  client: ConvexClient,
  tournament_id: TournamentId,
  viewer_session_id: string,
  attempts = 5,
  intervalMs = 5000,
): Promise<{ authenticated: boolean; proofs: RpsProof[] }> {
  let last: { authenticated: boolean; proofs: RpsProof[] } = { authenticated: false, proofs: [] }
  for (let i = 0; i < attempts; i++) {
    try {
      last = await confirmViewerCode(client, tournament_id, viewer_session_id)
      if (last.authenticated) return last
    } catch {
      // keep polling on transient errors
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs))
  }
  return last
}

export async function joinTournament(
  client: ConvexClient,
  tournament_id: TournamentId,
  viewer_session_id: string,
): Promise<{ participants: { id: unknown; display_name: string; via_stream_channel: string }[] }> {
  return await client.mutation(api.rps.join, { tournament_id, viewer_session_id })
}

export async function submitRpsMove(
  client: ConvexClient,
  args: {
    match_id: MatchId
    participant_id: ParticipantId
    move: RpsMove
    viewer_session_id: string
  },
): Promise<{ ok: true }> {
  return await client.mutation(api.rpsMatches.submitMove, args)
}

const RPS_IMG_BASE = 'https://mapcar.alwaysdata.net/static/img'

export const MOVE_IMAGE: Record<RpsMove, string> = {
  rock: `${RPS_IMG_BASE}/rock.png`,
  paper: `${RPS_IMG_BASE}/paper.png`,
  scissors: `${RPS_IMG_BASE}/scissor.png`,
}

export type RpsPlatform = 'vkvideo' | 'twitch' | 'kick' | 'wtv'

export type TournamentView = {
  id: TournamentId
  owner_stream_channel: string
  stream_channels: string[]
  status: 'registration' | 'running' | 'finished'
  current_round: number
  round_seconds: number
  winner_participant_id?: unknown
  winner_display_name?: string
  created_at: number
  started_at?: number
  finished_at?: number
}

export type ParticipantCard = {
  id: unknown
  platform: RpsPlatform
  user_slug: string
  display_name: string
  via_stream_channel: string
  wins: number
  status: string
  is_bot: boolean
}

export type RoundMatchView = {
  id: unknown
  round: number
  status: 'pending' | 'resolved'
  winner_id?: unknown
  is_draw?: boolean
  move_a?: RpsMove
  move_b?: RpsMove
  deadline_at: number
  resolved_at?: number
  a: ParticipantCard | null
  b: ParticipantCard | null
}

export type MyEntryView = {
  id: unknown
  platform: RpsPlatform
  user_slug: string
  display_name: string
  via_stream_channel: string
  wins: number
  status: string
  eliminated_in_round?: number
  is_bot: boolean
}

export type BoardMatchView = {
  id: unknown
  round: number
  status: string
  winner_id?: unknown
  is_draw?: boolean
  my_move?: RpsMove
  opp_move?: RpsMove
  i_won?: boolean
  deadline_at: number
  me: ParticipantCard | null
  opp: ParticipantCard | null
}

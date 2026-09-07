import { ConvexClient } from 'convex/browser'
import type { Id } from '../../../convex/_generated/dataModel.js'
import { api } from '../../../convex/_generated/api.js'
import { formatStreamChannel, getSessionId, setSessionId } from '$lib/session'

const url = import.meta.env.VITE_CONVEX_URL as string | undefined

let singleton: ConvexClient | null = null

export function convexClient(): ConvexClient {
  if (!url) throw new Error('VITE_CONVEX_URL is not set. Copy it from .env.local.')
  if (!singleton) singleton = new ConvexClient(url)
  return singleton
}

export type SuperGameStatus = 'win' | 'lose' | 'skip'

export type LotoWinner = {
  id: string
  username: string
  super_game_status: SuperGameStatus
  created_at: number
  stream_channel: string
}

export type AuthCheckResult =
  | { authenticated: true; session_id: string }
  | { authenticated: false; auth_key: string; session_id: string }

// Mirrors GET /api/auth_check (Handlers.fs:12-32) — single round trip,
// the auth key (when unauthenticated) comes back directly.
export async function authCheck(params: {
  server: string
  channel: string
}): Promise<AuthCheckResult> {
  const stream_channel = formatStreamChannel(params.server, params.channel)
  // No session yet → the backend mints one; we persist whatever it returns.
  const res = await convexClient().mutation(api.auth.check, {
    stream_channel,
    session_id: getSessionId(),
  })
  setSessionId(res.session_id)
  if (res.authenticated) return { authenticated: true, session_id: res.session_id }
  return { authenticated: false, auth_key: res.auth_key, session_id: res.session_id }
}

// Mirrors POST /api/auth (chat-proof confirm, polled 5x5s by AuthStore)
export async function confirmAuth(params: {
  server: string
  channel: string
}): Promise<{ authenticated: boolean }> {
  const stream_channel = formatStreamChannel(params.server, params.channel)
  const session_id = getSessionId()
  if (!session_id) return { authenticated: false }
  return await convexClient().action(api.auth.confirm, { stream_channel, session_id })
}

// Mirrors GET /api/loto_winners (public)
export async function fetchLotoWinners(params: {
  server: string
  channel: string
}): Promise<{ winners: LotoWinner[] }> {
  const stream_channel = formatStreamChannel(params.server, params.channel)
  const res = await convexClient().query(api.lotoWinners.list, { stream_channel })
  return {
    winners: res.winners.map((w) => ({
      id: w.id,
      username: w.username,
      super_game_status: w.super_game_status,
      created_at: w.created_at,
      stream_channel: w.stream_channel,
    })),
  }
}

// Mirrors POST /api/loto_winners — returns full winner objects (fixes the
// old `{ids}` shape mismatch in stream-tools/src/lib/api/loto.ts:139).
export async function createLotoWinners(params: {
  server: string
  channel: string
  winners: { username: string; super_game_status: SuperGameStatus }[]
}): Promise<{ winners: LotoWinner[] }> {
  const stream_channel = formatStreamChannel(params.server, params.channel)
  const session_id = getSessionId()
  if (!session_id) throw new Error('No session for this channel. Call authCheck first.')
  const res = await convexClient().mutation(api.lotoWinners.createBatch, {
    stream_channel,
    session_id,
    winners: params.winners,
  })
  return {
    winners: res.winners.map((w) => ({
      id: w.id,
      username: w.username,
      super_game_status: w.super_game_status,
      created_at: w.created_at,
      stream_channel: w.stream_channel,
    })),
  }
}

// Mirrors POST /api/loto_winners/:id
export async function updateLotoWinner(params: {
  id: string
  server: string
  channel: string
  super_game_status: SuperGameStatus
}): Promise<LotoWinner> {
  const session_id = getSessionId()
  if (!session_id) throw new Error('No session for this channel. Call authCheck first.')
  const updated = await convexClient().mutation(api.lotoWinners.updateStatus, {
    id: params.id as Id<'loto_winners'>,
    session_id,
    super_game_status: params.super_game_status,
  })
  return {
    id: updated.id,
    username: updated.username,
    super_game_status: updated.super_game_status,
    created_at: updated.created_at,
    stream_channel: updated.stream_channel,
  }
}

// Mirrors POST /api/frontend_logs
export async function createFrontendLogs(logs: string[]): Promise<void> {
  // Session is browser-wide; Convex resolves the channel from user_auth.
  const session_id = getSessionId()
  if (!session_id) throw new Error('No session yet. Call authCheck first.')
  await convexClient().mutation(api.frontendLogs.create, { session_id, logs })
}

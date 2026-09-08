// Convex-backed replacement for the F# Giraffe `/api` endpoints.
// Same export surface as the old REST client (no MOCK_API short-circuit):
// winners carry Convex string ids, and create returns full winner objects.
import type { ChatServer } from '../types'
import {
  authCheck as convexAuthCheck,
  confirmAuth as convexConfirmAuth,
  createFrontendLogs as convexCreateFrontendLogs,
  createLotoWinners as convexCreateLotoWinners,
  fetchLotoWinners as convexFetchLotoWinners,
  updateLotoWinner as convexUpdateLotoWinner,
  type SuperGameStatus as ConvexSuperGameStatus,
} from './lotoConvex'

export type AuthCheckParams = {
  server: ChatServer
  channel: string
}

export type AuthCheckResponse = {
  authenticated: boolean
  auth_key?: string
}

export async function authCheck(params: AuthCheckParams): Promise<AuthCheckResponse> {
  return convexAuthCheck(params)
}

export type AuthResponse = {
  authenticated: boolean
}

export async function auth(params: AuthCheckParams): Promise<AuthResponse> {
  return convexConfirmAuth(params)
}

export type SuperGameStatus = 'skip' | 'win' | 'lose'

export type LotoWinner = {
  id: string
  username: string
  super_game_status: SuperGameStatus
  created_at: number
  stream_channel: string
}

type FetchLotoWinnersResponse = {
  winners: LotoWinner[]
}

export async function fetchLotoWinners(params: AuthCheckParams): Promise<FetchLotoWinnersResponse> {
  const res = await convexFetchLotoWinners(params)
  return { winners: res.winners as LotoWinner[] }
}

export type LotoWinnerData = {
  username: string
  super_game_status: 'skip' | 'win' | 'lose'
}

export async function createLotoWinner(params: {
  server: ChatServer
  channel: string
  winner: LotoWinnerData
}): Promise<{ winners: LotoWinner[] }> {
  const res = await convexCreateLotoWinners({
    server: params.server,
    channel: params.channel,
    winners: [params.winner as { username: string; super_game_status: ConvexSuperGameStatus }],
  })
  return { winners: res.winners as LotoWinner[] }
}

export async function updateLotoWinner(params: {
  id: string
  super_game_status: 'skip' | 'win' | 'lose'
  server: ChatServer
  channel: string
}): Promise<LotoWinner> {
  const updated = await convexUpdateLotoWinner({
    id: params.id,
    server: params.server,
    channel: params.channel,
    super_game_status: params.super_game_status,
  })
  return updated as LotoWinner
}

export type FrontendLog = {
  id: string
  created_at: number
  session_id: string
  stream_channel: string
  log_text: string
}

export async function createFrontendLogs(logs: string[]): Promise<void> {
  return convexCreateFrontendLogs(logs)
}

// Thin Convex wrappers for backend loto games/tickets (mirrors rps.ts).
// Ticket display subscribes via useQuery(api.loto.list) in components;
// this module only holds the imperative calls.
import type { ConvexClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api.js'
import type { Id } from '../../../convex/_generated/dataModel.js'
import { getSessionId } from '$lib/session'

export type LotoGameId = Id<'loto_games'>
export type LotoTicketId = Id<'loto_tickets'>

function requireSession(): string {
  const session_id = getSessionId()
  if (!session_id) throw new Error('No session yet. Connect a chat first.')
  return session_id
}

export async function createLotoGame(
  client: ConvexClient,
  channels: string[],
): Promise<{ game_id: LotoGameId }> {
  return await client.mutation(api.loto.createGame, {
    session_id: requireSession(),
    channels,
  })
}

export async function setLotoChannels(
  client: ConvexClient,
  game_id: LotoGameId,
  channels: string[],
): Promise<{ game_id: LotoGameId; channels: string[] }> {
  return await client.mutation(api.loto.setChannels, {
    game_id,
    session_id: requireSession(),
    channels,
  })
}

export async function removeLotoTicket(
  client: ConvexClient,
  ticket_id: LotoTicketId,
): Promise<{ deleted: LotoTicketId }> {
  return await client.mutation(api.loto.removeTicket, {
    ticket_id,
    session_id: requireSession(),
  })
}

// Timer only: all chat I/O happens inside the Convex action via chatService.
export type SyncedTicket = {
  id: string
  owner_id: string
  owner_name: string
  value: string[]
  color: string
  variant: number
  type: 'chat' | 'points'
  source: { server: string; channel: string }
  created_at: number
  isLatecomer: boolean
}

export async function syncLotoGame(
  client: ConvexClient,
  game_id: LotoGameId,
  opts?: { ticket_size?: number; max_number?: number },
): Promise<{ tickets: SyncedTicket[]; synced: number }> {
  return await client.action(api.loto.sync, {
    game_id,
    session_id: requireSession(),
    ticket_size: opts?.ticket_size,
    max_number: opts?.max_number,
  })
}

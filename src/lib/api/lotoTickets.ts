// Thin Convex wrappers for backend loto games/tickets (mirrors rps.ts).
// Ticket display subscribes via useQuery(api.loto.list) in components;
// this module only holds the imperative calls.
import type { ConvexClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api.js'
import type { Id } from '../../../convex/_generated/dataModel.js'
import { getSessionId } from '$lib/session'
import type { LotoTicketDraft } from '$lib/stores/lotoStore.svelte'

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

export async function pushDrawnNumber(
  client: ConvexClient,
  game_id: LotoGameId,
  number: string,
): Promise<{ ignored: boolean; drawn_numbers: string[] }> {
  return await client.mutation(api.loto.pushDrawnNumber, {
    game_id,
    session_id: requireSession(),
    number,
  })
}

export async function setLotoWinner(
  client: ConvexClient,
  game_id: LotoGameId,
  ticket_id: LotoTicketId | null,
): Promise<{ winner_ticket_id?: LotoTicketId }> {
  return await client.mutation(api.loto.setWinner, {
    game_id,
    session_id: requireSession(),
    ticket_id: ticket_id ?? undefined,
  })
}

// Persists a frontend-created ticket (upserts on owner_id server-side,
// so resending from the same owner replaces the previous ticket).
export async function addLotoTicket(
  client: ConvexClient,
  game_id: LotoGameId,
  draft: LotoTicketDraft,
): Promise<{ ticket: StreamerTicket }> {
  return await client.mutation(api.loto.addTicket, {
    game_id,
    session_id: requireSession(),
    owner_id: draft.owner_id,
    owner_name: draft.owner_name,
    value: draft.value,
    type: draft.type,
    source_server: draft.source_server,
    source_channel: draft.source_channel,
    created_at: draft.created_at,
  })
}

export type StreamerTicket = {
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

// Generates (or re-rolls) a ticket for the streamer's main channel.
// Display arrives via the list subscription; the return is a fast path.
export async function addStreamerTicket(
  client: ConvexClient,
  game_id: LotoGameId,
  opts?: { ticket_size?: number; max_number?: number },
): Promise<{ ticket: StreamerTicket }> {
  return await client.mutation(api.loto.addStreamerTicket, {
    game_id,
    session_id: requireSession(),
    ticket_size: opts?.ticket_size,
    max_number: opts?.max_number,
  })
}

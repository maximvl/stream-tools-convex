import type { Doc } from './_generated/dataModel'

// Tickets/games older than this are evicted by cron.
export const LOTO_TTL_MS = 24 * 60 * 60 * 1000

// A game older than this with zero tickets is considered stale: its tickets
// have aged out (or it never got any) and the frontend auto-rotates to a
// fresh game on open. Kept below LOTO_TTL_MS so an active game never loses
// tickets underneath it. Mirrored in src/lib/constants.ts for the frontend.
export const LOTO_GAME_STALE_AFTER_MS = 20 * 60 * 60 * 1000

export type FrontendTicket = {
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

export function toFrontendTicket(row: Doc<'loto_tickets'>): FrontendTicket {
  return {
    id: row._id,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    value: row.value,
    color: row.color,
    variant: row.variant,
    type: row.type,
    source: { server: row.source_server, channel: row.source_channel },
    created_at: row.created_at,
    isLatecomer: row.isLatecomer,
  }
}

// Synthetic owner id for streamer tickets (generated or written by the
// channel owner in chat). Sharing one id means a later `+лото` message
// from the streamer upserts the generated ticket instead of duplicating it.
// NOTE: streamer chat tickets created before this scheme carry real
// platform ids and won't merge — they age out via the 24h eviction.
export function streamerOwnerId(server: string, channel: string): string {
  return `streamer/${server}/${channel.toLowerCase()}`
}

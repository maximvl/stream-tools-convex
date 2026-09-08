// Harvests chat user profiles (colors, badges, platform fields) for RPS
// participants by reading recent messages from the tournament's chats.
// Same source loto uses — plain fetch, no global store changes.
import { fetchMessages } from './api'
import type { ChatServer, ChatUser } from './types'

const WINDOW_MS = 10 * 60 * 1000

function parseChannel(raw: string): { server: ChatServer; channel: string } | null {
  const sep = raw.indexOf('/')
  if (sep <= 0 || sep === raw.length - 1) return null
  const server = raw.slice(0, sep).toLowerCase()
  const channel = raw.slice(sep + 1)
  if (server !== 'twitch' && server !== 'vkvideo' && server !== 'kick' && server !== 'wtv') {
    return null
  }
  return { server, channel }
}

export async function fetchRpsChatUsers(channels: string[]): Promise<Map<string, ChatUser>> {
  const ts = Date.now() - WINDOW_MS
  const settled = await Promise.allSettled(
    channels.map((raw) => {
      const parsed = parseChannel(raw)
      if (!parsed) return Promise.resolve(null)
      return fetchMessages({ channel: parsed.channel, platform: parsed.server, ts })
    }),
  )
  const users = new Map<string, ChatUser>()
  for (const r of settled) {
    if (r.status !== 'fulfilled' || !r.value) continue
    for (const m of r.value.messages ?? []) {
      // Freshest profile wins.
      users.set(m.user.displayName.toLowerCase(), m.user)
    }
  }
  return users
}

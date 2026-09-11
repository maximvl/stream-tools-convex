import { parseIdentity } from './userIdentity'

const CHAT_API = 'https://chats.eventlab.dev/api'

// Backend mirror of the eventlab chats API message shape
// (cf. `src/lib/types.ts` ChatMessage — kept local so convex/ stays
// self-contained). All fields the backend reads are explicit;
// nothing is `any`.
export type ChatServiceVkMention = {
  id: number
  displayName: string
}

export type ChatServiceTwitchFields = {
  highlighted: boolean
  mod?: boolean
  subscriber?: boolean
  color?: string
}

export type ChatServiceUser = {
  displayName: string
  id: string
  twitchFields?: ChatServiceTwitchFields
  kickFields?: {
    color?: string
  }
  wtvFields?: {
    nicknameColor?: string
    tags?: string[]
  }
}

export type ChatServiceMessage = {
  id: string
  timestampMs: number
  text: string
  user: ChatServiceUser
  vkFields?: {
    mentions?: ChatServiceVkMention[]
  }
}

type FetchParams = {
  server: string
  channel: string
  tsFrom: number
  textFilter?: string
}

function isValidMessage(msg: unknown): msg is ChatServiceMessage {
  if (typeof msg !== 'object' || msg === null) return false
  const m = msg as Record<string, unknown>
  if (typeof m['text'] !== 'string') return false
  const user = m['user'] as Record<string, unknown> | null | undefined
  if (typeof user !== 'object' || user === null) return false
  return typeof user['displayName'] === 'string'
}

// Single-channel fetch. Fail-open: any network error, non-OK status or
// malformed payload yields [] — callers treat "no messages" and "chat
// unreachable" the same way.
export async function fetchChatMessages(params: FetchParams): Promise<ChatServiceMessage[]> {
  const query = new URLSearchParams({
    server: params.server,
    channel: params.channel,
    tsFrom: String(params.tsFrom),
  })
  if (params.textFilter && params.textFilter.length > 0) {
    query.set('text_filter', params.textFilter)
  }
  let res: Response
  try {
    res = await fetch(`${CHAT_API}/chat_messages?${query.toString()}`)
  } catch {
    return []
  }
  if (!res.ok) return []
  let data: { messages: unknown }
  try {
    data = (await res.json()) as { messages: unknown }
  } catch {
    return []
  }
  if (!Array.isArray(data.messages)) return []
  return data.messages.filter(isValidMessage)
}

// Multi-channel fan-out. One slow/failed/invalid channel must not hold up
// the rest — mirrors the previous per-caller Promise.allSettled pattern.
export async function fetchChatMessagesBatch(
  streamChannels: string[],
  tsFrom: number,
  textFilter?: string,
): Promise<Map<string, ChatServiceMessage[]>> {
  const settled = await Promise.allSettled(
    streamChannels.map(async (streamChannel): Promise<[string, ChatServiceMessage[]]> => {
      let server: string
      let channel: string
      try {
        const identity = parseIdentity(streamChannel)
        server = identity.platform
        channel = identity.user_slug
      } catch {
        return [streamChannel, []]
      }
      const messages = await fetchChatMessages({ server, channel, tsFrom, textFilter })
      return [streamChannel, messages]
    }),
  )
  const out = new Map<string, ChatServiceMessage[]>()
  for (const r of settled) {
    if (r.status === 'fulfilled') out.set(r.value[0], r.value[1])
  }
  // Promise.allSettled never rejects, but keep the invariant explicit: every
  // input channel maps to an (possibly empty) list.
  for (const c of streamChannels) {
    if (!out.has(c)) out.set(c, [])
  }
  return out
}

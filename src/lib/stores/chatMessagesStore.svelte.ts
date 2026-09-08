import { LocalStore } from './localStore.svelte'
import type {
  ChatConnection,
  ChatServer,
  UserId,
  ChatUserWithSource,
  ChatMessageWithSource,
  ConnectionStatus,
} from '../types'
import type { ChatMessagesResponse } from '../api'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'

export type ConnKey = string & { readonly __brand: 'ConnKey' }

export function connToKey(connection: ChatConnection): ConnKey {
  return `${connection.server}/${connection.channel}` as ConnKey
}

// Consecutive failed message polls before a connection is considered dead.
// A single failed poll must NOT flip the status: that instantly unmounts the
// messages query, remounts the connect query (which refetches immediately),
// and on success remounts messages — a zero-delay connect↔messages flap that
// spams the chat API and freezes the page.
const MAX_MESSAGE_ERRORS = 5

export class ChatMessagesStore {
  connections = new LocalStore<ChatConnection[]>('chat-connections', [])
  connectionsStatuses = $state<Record<ConnKey, ConnectionStatus>>({})
  // Plain (non-reactive) per-connection error streaks. Kept out of $state on
  // purpose: they are write-heavy bookkeeping, not UI state.
  private messageErrorStreak: Record<string, number> = {}

  // Single choke point for status writes.
  setStatus(key: ConnKey, status: ConnectionStatus, _reason: string): void {
    const prev = this.connectionsStatuses[key]
    if (prev === status) return
    this.connectionsStatuses[key] = status
    // Fresh (re)join forgives past message failures so the next polls get a
    // full streak before they can bounce the connection back.
    if (status === 'connected') {
      this.messageErrorStreak[key] = 0
    }
  }
  disconnectedConnections = $derived.by(() => {
    return Object.keys(this.connectionsStatuses).filter((key) => {
      const [, channel] = key.split('/')
      return channel !== '' && this.connectionsStatuses[key as ConnKey] !== 'connected'
    }) as ConnKey[]
  })
  connectedConnections = $derived.by(() => {
    return Object.keys(this.connectionsStatuses).filter((key) => {
      const [, channel] = key.split('/')
      return channel !== '' && this.connectionsStatuses[key as ConnKey] === 'connected'
    }) as ConnKey[]
  })

  messages = $state<ChatMessageWithSource[]>([])
  newMessages = $state<ChatMessageWithSource[]>([])
  lastMessageReceivedPerConnection = $state<Record<ConnKey, ChatMessageWithSource>>({})

  messagesByUser = $derived.by(() => {
    const byUser = new SvelteMap<UserId, ChatMessageWithSource[]>()
    this.messages.forEach((msg) => {
      const userId = msg.user.id
      if (!byUser.has(userId)) {
        byUser.set(userId, [])
      }
      byUser.get(userId)!.push(msg)
    })
    return byUser
  })

  usersById = $derived.by(() => {
    const users = new SvelteMap<UserId, ChatUserWithSource>()
    this.messages.forEach((msg) => {
      users.set(msg.user.id, { ...msg.user, source: msg.source })
    })
    return users
  })

  // NOTE: chat polling lives in ChatChannelSync components (one stable
  // instance per configured channel, singular `createQuery` + `enabled`
  // gating). It used to be `createQueries` over a derived status list here,
  // but every status flip rebuilt the observer — with an immediate refetch —
  // turning fast failures into a tight request storm that froze the page.

  // Called by ChatChannelSync with settled messages results. Owns the error
  // streak: only sustained failure drops the connection (which re-enables the
  // connect query). Transient blips self-heal in place without touching
  // status, so polling observers are never torn down by errors.
  ingestMessagesResult(
    connKey: ConnKey,
    data: ChatMessagesResponse | undefined,
    err: unknown,
  ): void {
    if (err) {
      const streak = (this.messageErrorStreak[connKey] ?? 0) + 1
      this.messageErrorStreak[connKey] = streak
      if (streak >= MAX_MESSAGE_ERRORS) {
        this.setStatus(connKey, 'disconnected', `messages-streak=${streak}`)
      }
      return
    }
    if (!data) return

    this.messageErrorStreak[connKey] = 0

    const [server, channel] = connKey.split('/') as [ChatServer, string]
    const messagesIds = new SvelteSet(this.messages.map((msg) => msg.id))
    const newMessages: ChatMessageWithSource[] = (data.messages || [])
      .filter((msg) => !messagesIds.has(msg.id))
      .map((msg) => ({
        ...msg,
        source: { server, channel },
      }))

    if (newMessages.length > 0) {
      this.newMessages = newMessages
      this.messages.push(...newMessages)
    }

    if (data.messages) {
      const lastMsg = data.messages[data.messages.length - 1]
      const lastMsgWithSource: ChatMessageWithSource = {
        ...lastMsg,
        source: { server, channel },
      }
      if (this.lastMessageReceivedPerConnection[connKey]) {
        if (
          lastMsg &&
          lastMsg.timestampMs > this.lastMessageReceivedPerConnection[connKey].timestampMs
        ) {
          this.lastMessageReceivedPerConnection[connKey] = lastMsgWithSource
        }
      } else if (lastMsg) {
        this.lastMessageReceivedPerConnection[connKey] = lastMsgWithSource
      }
    }
  }

  constructor() {
    this.connections.value.forEach((c) => {
      this.setStatus(connToKey(c), 'disconnected', 'init')
    })
  }

  updateConnections(connections: ChatConnection[]) {
    // Skip no-op writes: replacing `connectionsStatuses`/`connections.value`
    // with equal-content copies retriggers every derived query list, which
    // tears down and immediately refetches all polling queries (visible as a
    // duplicate connect burst on every page load via the dialog mount sync).
    const prev = this.connections.value
    const same =
      prev.length === connections.length &&
      prev.every(
        (c, i) => c.server === connections[i]?.server && c.channel === connections[i]?.channel,
      ) &&
      connections.every((c) => connToKey(c) in this.connectionsStatuses)
    if (same) return
    // Keep old statuses for existing connections
    const newStatuses: Record<ConnKey, ConnectionStatus> = {}
    connections.forEach((c) => {
      const key = connToKey(c)
      newStatuses[key] = this.connectionsStatuses[key] || 'disconnected'
    })

    this.connectionsStatuses = newStatuses
    this.connections.value = connections
  }

  addConnection() {
    const newConn: ChatConnection = {
      server: 'twitch',
      channel: '',
    }
    this.connections.value.push(newConn)
    this.setStatus(connToKey(newConn), 'disconnected', 'add-connection')
  }

  removeConnection(connection: ChatConnection) {
    const key = connToKey(connection)
    const next: Record<ConnKey, ConnectionStatus> = {}
    for (const k of Object.keys(this.connectionsStatuses) as ConnKey[]) {
      if (k !== key) next[k] = this.connectionsStatuses[k]
    }
    this.connectionsStatuses = next
    delete this.messageErrorStreak[key]
    this.connections.value = this.connections.value.filter((c) => c !== connection)
  }

  cleanupEmptyConnections() {
    this.connections.value = this.connections.value.filter((c) => c.channel.trim() !== '')
  }
}

import { createQueries } from '@tanstack/svelte-query'
import { LocalStore } from './localStore.svelte'
import type { ChatConnection, ChatServer, UserId, ChatUserWithSource, ChatMessageWithSource, ConnectionStatus } from '../types'
import { chatConnect, fetchMessages } from '../api'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'
import { untrack } from 'svelte'

export type ConnKey = string & { readonly __brand: 'ConnKey' }

export function connToKey(connection: ChatConnection): ConnKey {
  return `${connection.server}/${connection.channel}` as ConnKey
}

export class ChatMessagesStore {
  connections = new LocalStore<ChatConnection[]>('chat-connections', [])
  connectionsStatuses = $state<Record<ConnKey, ConnectionStatus>>({})
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

  connectionQueries = createQueries(() => {
    // console.log('creating connection queries for:', this.disconnectedConnections)
    return {
      queries: this.disconnectedConnections.map((key) => {
        const [server, channel] = key.split('/')
        return {
          queryKey: ['chat-connect', server, channel],
          queryFn: async () =>
            chatConnect({
              server: server as ChatServer,
              channel,
            }),
          refetchInterval: 3000,
          retry: 0
        }
      }),
      combine: (results) => {
        // console.log('combining connection queries results:', results)
        results.forEach((res, idx) => {
          const key = this.disconnectedConnections[idx]
          if (!key) return
          if (res.isFetching) {
            this.connectionsStatuses[key] = 'connecting'
            return
          }
          if (res.data?.status.status) {
            this.connectionsStatuses[key] = res.data.status.status
          } else {
            this.connectionsStatuses[key] = 'disconnected'
            console.log(`Failed to connect ${key}:`, res.error, res.data)
          }
        })
        return results
      },
    }
  })

  messagesResponses = createQueries(() => {
    const nowTs = Date.now()
    // console.log('creating messages queries for:', this.connectedConnections)
    return {
      queries: this.connectedConnections.map((connKey) => {
        const [server, channel] = connKey.split('/')
        return {
          queryKey: ['fetch-chat-messages', server, channel],
          queryFn: async () => {
            const ts = untrack(() => this.lastMessageReceivedPerConnection[connKey]?.timestampMs || nowTs) - 10 * 1000
            const msgs = await fetchMessages({
              platform: server as ChatServer,
              channel,
              ts,
              textFilter: '',
            })
            // console.log(`Fetched messages for ${connKey}:`, msgs)
            return msgs
          },
          refetchInterval: 2000,
          retry: 0,
        }
      }),
      combine: (results) => {
        // console.log('combining messages queries results:', results)
        const messagesIds = new SvelteSet(this.messages.map((msg) => msg.id))
        results.forEach((res, idx) => {
          const key = this.connectedConnections[idx]
          if (!key) return

          if (res.isError) {
            this.connectionsStatuses[key] = 'disconnected'
            console.log(`Failed to fetch messages for ${key}:`, res.error, res.data)
            return
          }

          if (res.isFetching) {
            return
          }

          const newMessages: ChatMessageWithSource[] = (res.data?.messages || [])
            .filter((msg) => !messagesIds.has(msg.id))
            .map((msg) => ({
              ...msg,
              source: {
                server: key.split('/')[0] as ChatServer,
                channel: key.split('/')[1],
              },
            }))

          if (newMessages.length > 0) {
            this.newMessages = newMessages
            this.messages.push(...newMessages)
          }

          if (res.data?.messages) {
            const lastMsg = res.data.messages[res.data.messages.length - 1]
            const lastMsgWithSource: ChatMessageWithSource = {
              ...lastMsg,
              source: {
                server: key.split('/')[0] as ChatServer,
                channel: key.split('/')[1],
              },
            }
            if (this.lastMessageReceivedPerConnection[key]) {
              if (lastMsg && lastMsg.timestampMs > this.lastMessageReceivedPerConnection[key].timestampMs) {
                this.lastMessageReceivedPerConnection[key] = lastMsgWithSource
              }
            } else if (lastMsg) {
              this.lastMessageReceivedPerConnection[key] = lastMsgWithSource
            }
          }
        })
        return results
      },
    }
  })

  constructor() {
    this.connections.value.forEach((c) => {
      this.connectionsStatuses[connToKey(c)] = 'disconnected'
    })
  }

  updateConnections(connections: ChatConnection[]) {
    console.log('updating connections', connections)
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
    this.connectionsStatuses[connToKey(newConn)] = 'disconnected'
  }

  removeConnection(connection: ChatConnection) {
    const key = connToKey(connection)
    const next: Record<ConnKey, ConnectionStatus> = {}
    for (const k of Object.keys(this.connectionsStatuses) as ConnKey[]) {
      if (k !== key) next[k] = this.connectionsStatuses[k]
    }
    this.connectionsStatuses = next
    this.connections.value = this.connections.value.filter((c) => c !== connection)
  }

  cleanupEmptyConnections() {
    this.connections.value = this.connections.value.filter((c) => c.channel.trim() !== '')
  }
}

import { createContext } from 'svelte'
import { useConvexClient } from 'convex-svelte'
import type { ConvexClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api.js'
import { getSessionId } from '$lib/session'
import type { ChatConnection, ChatServer } from '$lib/types'
import { connToKey, type ConnKey } from './chatMessagesStore.svelte'

const CONFIRM_INTERVAL_MS = 5000
const CONFIRM_MAX_ATTEMPTS = 5

export type AuthConnectionInfo = {
  key: ConnKey
  server: ChatServer
  channel: string
  authenticated: boolean
  authKey?: string
  isChecking: boolean
  isConfirming: boolean
}

// Registry for per-connection auth UI state. The actual auth state comes from
// reactive AuthChannel subscriptions (useQuery api.auth.check); this store
// only holds their mirrored state plus the confirm-action polling loop.
export class AuthStore {
  connections = $state<ConnKey[]>([])

  connectionInfo = $state<Record<ConnKey, AuthConnectionInfo>>({})

  private convex: ConvexClient

  constructor() {
    // Runs during component initialisation (page script top-level), where
    // reading the convex-svelte context is legal.
    this.convex = useConvexClient()
  }

  confirmAuth(connKey: ConnKey, max_attempts: number = CONFIRM_MAX_ATTEMPTS) {
    const [server, channel] = connKey.split('/') as [ChatServer, string]
    const stream_channel = `${server}/${channel}`
    const session_id = getSessionId()
    const info = this.connectionInfo[connKey]
    if (!session_id) {
      if (info) info.isConfirming = false
      return
    }
    if (info) info.isConfirming = true

    let attempts = 0
    const tick = async () => {
      attempts++
      try {
        const res = await this.convex.action(api.auth.confirm, { stream_channel, session_id })
        if (res.authenticated) {
          const done = this.connectionInfo[connKey]
          if (done) {
            done.authenticated = true
            done.isConfirming = false
          }
          return
        }
      } catch {
        // ignore errors, keep polling
      }
      const i = this.connectionInfo[connKey]
      // Stop when the entry is gone, when auth flipped live via the
      // AuthChannel subscription, or when attempts run out.
      if (!i || i.authenticated || attempts >= max_attempts) {
        if (i) i.isConfirming = false
        return
      }
      setTimeout(tick, CONFIRM_INTERVAL_MS)
    }
    void tick()
  }

  add(c: ChatConnection) {
    this.connections.push(connToKey(c))
  }
}

export const [getAuthStore, setAuthStore] = createContext<AuthStore>()

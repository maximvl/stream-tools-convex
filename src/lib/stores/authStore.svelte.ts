import { createContext, untrack } from 'svelte'
import { auth, authCheck } from '$lib/api/loto'
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

export class AuthStore {
  connections = $state<ConnKey[]>([])

  connectionInfo = $state<Record<ConnKey, AuthConnectionInfo>>({})

  constructor() {
    $effect(() => {
      const keys = this.connections
      for (const key of keys) {
        untrack(() => this.fetchAuth(key))
      }
    })
  }

  private fetchAuth(key: ConnKey) {
    const [server, channel] = key.split('/')
    let info = this.connectionInfo[key]
    if (!info) {
      this.connectionInfo[key] = {
        key,
        server: server as ChatServer,
        channel,
        authenticated: false,
        isChecking: true,
        isConfirming: false,
      }
      info = this.connectionInfo[key]
    } else {
      info.isChecking = true
    }
    authCheck({ server: server as ChatServer, channel })
      .then((res) => {
        const i = this.connectionInfo[key]
        if (!i) return
        i.isChecking = false
        i.authenticated = res.authenticated
        i.authKey = res.auth_key
      })
      .catch(() => {
        const i = this.connectionInfo[key]
        if (i) i.isChecking = false
      })
  }

  refreshAll() {
    for (const key of this.connections) {
      this.fetchAuth(key)
    }
  }

  confirmAuth(connKey: ConnKey, max_attempts: number = CONFIRM_MAX_ATTEMPTS) {
    const [server, channel] = connKey.split('/')
    const info = this.connectionInfo[connKey]
    if (info) info.isConfirming = true

    let attempts = 0
    const tick = async () => {
      attempts++
      try {
        const res = await auth({ server: server as ChatServer, channel })
        const i = this.connectionInfo[connKey]
        if (i) i.authenticated = res.authenticated
        if (res.authenticated) {
          if (i) i.isConfirming = false
          return
        }
      } catch {
        // ignore errors, keep polling
      }
      const i = this.connectionInfo[connKey]
      if (attempts >= max_attempts) {
        if (i) i.isConfirming = false
      } else {
        setTimeout(tick, CONFIRM_INTERVAL_MS)
      }
    }
    tick()
  }

  add(c: ChatConnection) {
    this.connections.push(connToKey(c))
  }
}

export const [getAuthStore, setAuthStore] = createContext<AuthStore>()

// Session token store — replaces the F# `session_id` cookie.
// Convex cannot set cookies, so the client persists ONE session id per
// browser instance in localStorage (key `convex-app:session`), like a
// classic cookie. The same session authenticates all of the streamer's
// channels: `user_auth` holds one row per channel, all sharing the session.
//
// Session ids are minted ONLY by the backend (`api.auth.check` with no
// session_id). This module never generates them — it only persists what the
// server returns.

export function formatStreamChannel(server: string, channel: string): string {
  return `${server.trim().toLowerCase()}/${channel.trim().toLowerCase()}`
}

const GLOBAL_KEY = 'convex-app:session'
const LEGACY_PREFIX = 'convex-app:session:'

export function getSessionId(): string | undefined {
  try {
    const direct = localStorage.getItem(GLOBAL_KEY)
    if (direct) return direct
    // One-time migration from pre-unification per-channel keys: adopt the
    // first legacy session so existing auths survive the upgrade, then drop
    // the legacy keys. Channels authed under a *different* legacy session
    // will simply show as unauthenticated until re-confirmed.
    let adopted: string | undefined
    const legacyKeys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(LEGACY_PREFIX)) {
        legacyKeys.push(key)
        if (!adopted) {
          const value = localStorage.getItem(key)
          if (value) adopted = value
        }
      }
    }
    for (const key of legacyKeys) localStorage.removeItem(key)
    if (adopted) localStorage.setItem(GLOBAL_KEY, adopted)
    return adopted
  } catch {
    return undefined
  }
}

export function setSessionId(sessionId: string): void {
  try {
    localStorage.setItem(GLOBAL_KEY, sessionId)
  } catch {
    // ignore quota / privacy-mode errors
  }
}

// Runs `mint` exactly once per page load when no session is stored yet, so
// N channels mounting at the same time don't mint N competing sessions on
// the backend. First minted id wins; losers re-check under the kept session.
let mintInflight: Promise<string> | null = null

export function mintSingleFlight(mint: () => Promise<string>): Promise<string> {
  const existing = getSessionId()
  if (existing) return Promise.resolve(existing)
  if (!mintInflight) {
    mintInflight = mint()
      .then((id) => {
        if (!getSessionId()) setSessionId(id)
        const kept = getSessionId()
        if (!kept) throw new Error('Session was not persisted')
        return kept
      })
      .finally(() => {
        mintInflight = null
      })
  }
  return mintInflight
}

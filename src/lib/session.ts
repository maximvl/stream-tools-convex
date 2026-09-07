// Session token store — replaces the F# `session_id` cookie.
// Convex cannot set cookies, so the client persists one session id per
// stream channel in localStorage (keyed `convex-app:session:<channel>`).

export function formatStreamChannel(server: string, channel: string): string {
  return `${server.trim().toLowerCase()}/${channel.trim().toLowerCase()}`
}

function storageKey(streamChannel: string): string {
  return `convex-app:session:${streamChannel.toLowerCase()}`
}

export function getSessionId(streamChannel: string): string | undefined {
  try {
    return localStorage.getItem(storageKey(streamChannel)) ?? undefined
  } catch {
    return undefined
  }
}

export function setSessionId(streamChannel: string, sessionId: string): void {
  try {
    localStorage.setItem(storageKey(streamChannel), sessionId)
  } catch {
    // ignore quota / privacy-mode errors
  }
}

// Client-side session bootstrap: stable per channel, so reactive queries keep
// the same args across re-renders instead of minting a new id per call.
export function ensureSessionId(streamChannel: string): string {
  const existing = getSessionId(streamChannel)
  if (existing) return existing
  const bytes = crypto.getRandomValues(new Uint8Array(15))
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const fresh = Array.from(bytes, (b) => chars[b % chars.length]).join('')
  setSessionId(streamChannel, fresh)
  return fresh
}

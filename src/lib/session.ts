// Session token store — replaces the F# `session_id` cookie.
// Convex cannot set cookies, so the client persists one session id per
// stream channel in localStorage (keyed `convex-app:session:<channel>`).

export function formatStreamChannel(server: string, channel: string): string {
  return `${server}/${channel}`
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

export type Platform = 'vkvideo' | 'twitch' | 'kick' | 'wtv'

const PLATFORMS: ReadonlySet<string> = new Set(['vkvideo', 'twitch', 'kick', 'wtv'])

export function parseIdentity(streamChannel: string): { platform: Platform; user_slug: string } {
  const normalized = streamChannel.trim().toLowerCase()
  const sep = normalized.indexOf('/')
  if (sep <= 0 || sep === normalized.length - 1) throw new Error('Invalid stream_channel')
  const platform = normalized.slice(0, sep)
  const user_slug = normalized.slice(sep + 1)
  if (!PLATFORMS.has(platform)) throw new Error('Invalid stream_channel')
  if (!user_slug) throw new Error('Invalid stream_channel')
  return { platform: platform as Platform, user_slug }
}

export function streamChannelFor(platform: string, user_slug: string): string {
  return `${platform}/${user_slug}`
}

export function cacheKeyFor(platform: string, user_slug: string, sessionId: string): string {
  return `${platform}/${user_slug}${sessionId}`
}

export type ChatServer = 'twitch' | 'vkvideo' | 'kick' | 'wtv'

export type ChatConnection = {
  server: ChatServer
  channel: string
}

type VkUserRole = {
  id: string
  name: string
  largeUrl: string
  priority: number
}

type VkUserBadgeAchievement = {
  name: string
  type: string
}

type VkUserBadge = {
  id: string // this is uuid
  name: string
  largeUrl: string
  achievement: VkUserBadgeAchievement
}

type VkUserFields = {
  nickColor: number
  isChatModerator: boolean
  isChannelModerator: boolean
  roles: VkUserRole[]
  badges: VkUserBadge[]
}

type TwitchBadge = {
  id: string
  title: string
  imageUrl: string
}

type TwitchUserFields = {
  badges: TwitchBadge[]
  color: string
  highlighted: boolean
  mod: boolean
  subscriber: boolean
  turbo: boolean
}

type KickBadge = {
  type: string
  name: string
  imageUrl?: string
  selected: boolean
}

type KickUserFields = {
  badges: KickBadge[]
  color: string
}

export type WtvUserFields = {
  nicknameColor: string
  tags: string[]
}

export type UserId = string & { readonly __brand: 'UserId' }

export type ChatUser = {
  id: UserId
  displayName: string
  vkFields?: VkUserFields
  twitchFields?: TwitchUserFields
  kickFields?: KickUserFields
  wtvFields?: WtvUserFields
}

export type ChatUserWithSource = ChatUser & {
  source: ChatConnection
}

export type VkMention = {
  id: number
  displayName: string
}

type VkChatFields = {
  mentions: VkMention[]
}

export type ChatMessage = {
  id: string
  timestampMs: number
  text: string
  user: ChatUser
  vkFields?: VkChatFields
}

export type ChatMessageWithSource = ChatMessage & {
  source: ChatConnection
}

export type VkRoleId = string & { readonly __brand: 'VkRoleId' }

export type VkRole = {
  id: VkRoleId
  name: string
  largeUrl: string
  description: string
  bgColor: number
  price: number
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

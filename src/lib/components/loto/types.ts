import type { ChatConnection, UserId, VkRoleId } from '$lib/types'

export type LotoTicketId = string & { readonly brand: unique symbol }

export type LotoTicket = {
  id: LotoTicketId
  owner_id: UserId
  owner_name: string
  value: string[]
  color: string
  variant: number
  type: 'chat' | 'points'
  source: ChatConnection
  created_at: number
  isLatecomer: boolean
}

export type SuperGameReward =
  | { kind: 'empty' | 'x1' | 'x2' | 'x3' | 'bomb' }
  | { kind: 'vk-role'; roleId: VkRoleId }

export type VkRewards = {
  [streamKey: string]: { [id: VkRoleId]: number }
}
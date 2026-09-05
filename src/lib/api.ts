import { makeMessage, MocksManager } from './apiMocks'
import type { ChatMessage, ChatServer, VkRole, VkRoleId } from './types'
import { dev } from '$app/environment'

const TURNIR_API = '/v2/turnir-api'
const CHAT_API = 'https://chats.eventlab.dev/api'

// const URL_PREFIX = 'http://localhost:8088/v2'

// const MOCK_API = import.meta.env.MODE === 'development' && !URL_PREFIX.includes('127.0.0.1')
const MOCK_API = dev

console.log('MOCK_API', MOCK_API)

const throwApiError: boolean = false
const mockedMessagesAmount = 20

export class ApiError extends Error {
  status: number
  body: {
    error: string
  }

  constructor(
    status: number,
    body: {
      error: string
    },
  ) {
    super(`API Error: ${status}`)
    this.status = status
    this.body = body
  }
}

export type FetchMessagesParams = {
  channel: string
  platform: ChatServer
  ts: number
  textFilter?: string
}

export type ChatMessagesResponse = {
  messages: null | ChatMessage[]
}

export async function fetchMessages({
  channel,
  ts,
  textFilter,
  platform,
}: FetchMessagesParams): Promise<ChatMessagesResponse> {
  const params = new URLSearchParams()
  params.set('server', platform)
  params.set('channel', channel)
  params.set('tsFrom', ts.toString())
  if (textFilter && textFilter.length > 0) {
    params.set('text_filter', textFilter)
  }
  const url = `${CHAT_API}/chat_messages?${params.toString()}`

  if (MOCK_API) {
    console.log(`GET ${url}`)

    if (throwApiError) {
      // Simulate an API error
      console.log('throwing api error')
      throw new ApiError(400, {
        error: 'channel not found',
      })
    }

    // console.log('fetching messages', channel, ts, textFilter, platform)

    if (MocksManager.chatMessages && MocksManager.chatMessages.length > 0) {
      const result: ChatMessagesResponse = {
        messages: MocksManager.chatMessages as ChatMessage[],
      }
      MocksManager.chatMessages = []
      return result
    }

    // return { chat_messages: [] }

    // const gameMessages = [makeGameMessage(), makeGameMessage()]
    // return { chat_messages: [makeSuperGameMessage()] }
    const mocksPerRequest = 1
    const mocksLeft = mockedMessagesAmount - mocksPerRequest

    // console.log({ mocksLeft, mockedMessagesAmount, mocksPerRequest })

    if (mocksLeft < 0) {
      return { messages: [] }
    }

    const messages = Array.from({ length: mocksPerRequest }, () => {
      return makeMessage()
    })

    messages.forEach((m) => {
      // m.message = sample(['1', '2', '3', '4', '5'])
      m.user.kickFields = {
        badges: [
          {
            type: 'moderator',
            name: 'Moderator',
            selected: true,
          },
        ],
        color: '#00FFFF',
      }
    })

    // console.log({ messages })

    return { messages: messages }
  }

  return fetch(url).then(async (res) => {
    const data = await res.json()
    if (!res.ok) {
      throw new ApiError(res.status, data)
    }
    return data
  })
}

type ChatConnectParams = {
  server: ChatServer
  channel: string
}

export type ChatConnectResponse = {
  status: {
    status: 'connected' | 'disconnected' | 'connecting'
  }
}

export async function chatConnect({
  server,
  channel,
}: ChatConnectParams): Promise<ChatConnectResponse> {
  const url = `${CHAT_API}/chat_connect`

  if (MOCK_API) {
    console.log(`POST ${url}`)
    await new Promise((resolve) => setTimeout(resolve, 3000))
    return { status: { status: 'connected' } }
  }

  return fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      channel,
      server,
    }),
  }).then((res) => res.json())
}

type VkRolesResponse = {
  roles: {
    data: {
      rewards: VkRole[]
    }
  }
}

export async function fetchVkRoles(server: ChatServer, channel: string): Promise<VkRolesResponse> {
  const params = new URLSearchParams()
  params.set('platform', server)
  params.set('channel', channel)
  const url = `${TURNIR_API}/stream_info?${params.toString()}`

  if (MOCK_API) {
    console.log(`GET ${url}`)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return {
      roles: {
        data: {
          rewards: [
            {
              id: '1' as VkRoleId,
              name: 'Role 1',
              largeUrl:
                'https://images.live.vkvideo.ru/smile/09868612-8082-4316-8df9-25bd147ebbd0/icon/size/small?change_time=1686325477',
              description: '',
              bgColor: 0,
              price: 0,
            },
            {
              id: '2' as VkRoleId,
              name: 'Role 2',
              largeUrl:
                'https://images.live.vkvideo.ru/smile/1fe2bca1-d6d5-4063-9860-f6a1d8e3816e/icon/size/small?change_time=1759944303',
              description: '',
              bgColor: 0,
              price: 0,
            },
          ],
        },
      },
    }
  }

  return fetch(url).then(async (res) => {
    const data = await res.json()
    if (!res.ok) {
      throw new ApiError(res.status, data)
    }
    return data
  })
}

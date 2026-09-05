import random from 'lodash/random'
import sample from 'lodash/sample'
import type { ChatMessage, UserId } from './types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const makeBadge = () => {
  return {
    id: '232c3913-274a-4c02-8d23-6576f7d48e98',
    name: 'Топ 1',
    largeUrl:
      'https://images.live.vkplay.ru/badge/232c3913-274a-4c02-8d23-6576f7d48e98/icon/size/large?change_time=1691761874',
    achievement: {
      name: 'Топ 1',
      type: 's',
    },
  }
}

export const makeMessage = (user_id?: string): ChatMessage => {
  const userId = user_id || random(1, 10000).toString()
  const colors = [
    '#0000FF',
    '#FF7F50',
    '#1E90FF',
    '#00FF7F',
    '#9ACD32',
    '#008000',
    '#FF4500',
    '#FF0000',
    '#DAA520',
    '#FF69B4',
    '#5F9EA0',
    '#2E8B57',
    '#D2691E',
    '#8A2BE2',
    '#B22222',
  ]

  const randomUUID = crypto.randomUUID()

  return {
    id: `${user_id}-${randomUUID}`,
    text: sample(['+игра']),
    timestampMs: new Date().getTime(),
    // Math.round(
    // new Date().getTime()
    // fixed date based on user id for testing
    //user_id % 2 === 0 ? '2024-10-01T12:00:00Z' : '2024-10-02T12:00:00Z'
    user: {
      id: userId as UserId,
      displayName: userId,
      // vk_fields: {
      //   nickColor: 0,
      //   isChatModerator: false,
      //   isChannelModerator: false,
      //   badges: [makeBadge(), makeBadge(), makeBadge()],
      //   roles: [],
      // },
      twitchFields: {
        color: sample(colors) ?? '',
        highlighted: true,
        mod: false,
        subscriber: false,
        turbo: false,
        badges: [],
      },
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const makeBotMessage = () => {
  const user_id = random(1, 100)
  return {
    id: '93152579',
    message: 'получил награду лото',
    ts: Math.round(new Date().getTime() / 1000),
    user: {
      id: 0,
      username: 'ChatBot',
    },
    vk_fields: {
      mentions: [{ id: 5, displayName: user_id.toString() }],
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const makeGameMessage = () => {
  const user_id = random(1, 300)
  return {
    id: '93152579',
    message: '+игра',
    ts: Math.round(new Date().getTime()),
    user: {
      id: user_id,
      username: `Player-${user_id}`,
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const makeSuperGameMessage = () => {
  const user_id = 58
  return {
    id: `${user_id}-super6`,
    message: '+супер 1 2',
    ts: Math.round(new Date().getTime() / 1000),
    user: {
      id: `${user_id}`,
      username: `Player-${user_id}`,
    },
  }
}

export const MocksManager = {
  chatMessages: [] as ChatMessage[],
  sendMessage(user_id: string, msg: string) {
    const obj = makeMessage(user_id)
    obj.text = msg
    obj.timestampMs = new Date().getTime()
    this.chatMessages.push(obj)
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).mocks = MocksManager

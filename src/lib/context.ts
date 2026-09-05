import { getContext } from 'svelte'
import type { ChatMessagesStore } from './stores/chatMessagesStore.svelte'
import { QueryClient } from '@tanstack/svelte-query'

export function getChatStore() {
  return getContext('chat-store') as ChatMessagesStore
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
    },
  },
})

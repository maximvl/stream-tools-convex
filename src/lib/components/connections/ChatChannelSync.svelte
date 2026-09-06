<script lang="ts">
  // Per-channel chat sync with singular `createQuery` calls + `enabled`
  // gating. Status flips only update observer options in place — the observer
  // is created once per mounted component and never rebuilt, so failures stay
  // spaced by the polling interval instead of snowballing: the old
  // `createQueries`-over-derived-list design rebuilt the observer (with an
  // immediate refetch) on every status flip, turning fast failures into a
  // ~20 req/s storm that froze the page.
  import { createQuery } from '@tanstack/svelte-query'
  import { untrack } from 'svelte'
  import { chatConnect, fetchMessages } from '$lib/api'
  import type { ChatServer } from '$lib/types'
  import type { ChatMessagesStore, ConnKey } from '$lib/stores/chatMessagesStore.svelte'

  let { store, connKey }: { store: ChatMessagesStore; connKey: ConnKey } = $props()

  const server = $derived(connKey.split('/')[0] as ChatServer)
  const channel = $derived(connKey.split('/')[1] as string)
  const status = $derived(store.connectionsStatuses[connKey] ?? 'disconnected')

  const connectQuery = createQuery(() => ({
    queryKey: ['chat-connect', server, channel],
    queryFn: () => chatConnect({ server, channel }),
    // Back off on repeated failures (3s → 6s → … → 60s cap). Resets on
    // success, so auto-recovery is preserved — worst case is 1 req/min.
    refetchInterval: (query: { state: { fetchFailureCount: number } }) => {
      const fails = query.state.fetchFailureCount
      if (fails <= 0) return 3000
      return Math.min(3000 * 2 ** Math.min(fails, 5), 60000)
    },
    retry: 0,
    enabled: status !== 'connected',
  }))

  // Mirror connect results into shared status (transitions only).
  $effect(() => {
    const fetching = connectQuery.isFetching
    const data = connectQuery.data
    const err = connectQuery.error
    untrack(() => {
      if (fetching) {
        store.setStatus(connKey, 'connecting', 'connect-fetch-start')
        return
      }
      if (data?.status?.status) {
        store.setStatus(connKey, data.status.status, 'connect-response')
      } else if (data !== undefined || err) {
        store.setStatus(connKey, 'disconnected', 'connect-response-missing-status')
      }
    })
  })

  const nowTs = Date.now()

  const messagesQuery = createQuery(() => ({
    queryKey: ['fetch-chat-messages', server, channel],
    queryFn: async () => {
      const ts =
        untrack(() => store.lastMessageReceivedPerConnection[connKey]?.timestampMs) || nowTs
      return fetchMessages({
        platform: server,
        channel,
        ts: ts - 10 * 1000,
        textFilter: '',
      })
    },
    refetchInterval: 2000,
    retry: 0,
    enabled: status === 'connected',
  }))

  $effect(() => {
    const data = messagesQuery.data
    const err = messagesQuery.error
    if (data === undefined && err == null) return
    untrack(() => {
      store.ingestMessagesResult(connKey, data, err ?? undefined)
    })
  })
</script>

<script lang="ts">
  // One reactive Convex subscription per connected channel.
  // Replaces the TanStack `createQueries(fetchLotoWinners)` fan-out:
  // data arrives live without polling and lands in winnersHistory.
  import { useQuery } from 'convex-svelte'
  import { untrack } from 'svelte'
  import { api } from '../../../../convex/_generated/api.js'
  import type { ConnKey } from '$lib/stores/chatMessagesStore.svelte'
  import { getLotoStore } from '$lib/stores/lotoStore.svelte'

  let { connKey }: { connKey: ConnKey } = $props()

  const lotoStore = getLotoStore()
  const winners = useQuery(api.lotoWinners.list, () => ({
    stream_channel: connKey as string,
  }))

  $effect(() => {
    const data = winners.data
    if (data) {
      untrack(() => {
        lotoStore.winnersHistory[connKey] = data.winners.map((w) => ({
          id: w.id,
          username: w.username,
          super_game_status: w.super_game_status,
          created_at: w.created_at,
          stream_channel: w.stream_channel,
        }))
      })
    }
  })
</script>

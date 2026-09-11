<script lang="ts">
  // Reactive subscription to backend tickets for one game instance.
  // Mounted conditionally (only when a gameId exists) because this
  // convex-svelte version has no 'skip' support in useQuery.
  import { useQuery } from 'convex-svelte'
  import { untrack } from 'svelte'
  import { api } from '../../../../convex/_generated/api.js'
  import type { Id } from '../../../../convex/_generated/dataModel.js'
  import { getLotoStore } from '$lib/stores/lotoStore.svelte'
  import type { LotoTicket } from './types'

  let { gameId }: { gameId: string } = $props()

  const lotoStore = getLotoStore()
  const tickets = useQuery(api.loto.list, () => ({
    game_id: gameId as Id<'loto_games'>,
  }))

  $effect(() => {
    // Settle (data or error) ends the loading state; on error the UI
    // simply shows the empty state instead of spinning forever.
    if (tickets.data !== undefined || tickets.error) {
      untrack(() => {
        lotoStore.markTicketsLoaded()
      })
    }
    const data = tickets.data?.tickets
    if (data) {
      untrack(() => {
        lotoStore.setRemoteTickets(data as LotoTicket[])
      })
    }
  })
</script>

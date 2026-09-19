<script lang="ts">
  // Reactive subscription to backend tickets for one game instance.
  // Mounted conditionally (only when a gameId exists) because this
  // convex-svelte version has no 'skip' support in useQuery.
  //
  // The backend is a cold backup, not a live source of truth: tickets are
  // persisted on creation (ticketSaver) so a page refresh can restore them,
  // but the live list is applied only once — the first payload per game —
  // and later updates are ignored. This keeps the local grid stable while
  // playing: no echo overwrites, no reorder replays on every backend write.
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

  // Game id whose initial payload was already applied. A new gameId means
  // a fresh first load (refresh restore or fresh attach) and syncs once.
  let syncedFor: string | null = null

  $effect(() => {
    // Settle (data or error) ends the loading state; on error the UI
    // simply shows the empty state instead of spinning forever.
    if (tickets.data !== undefined || tickets.error) {
      untrack(() => {
        lotoStore.markTicketsLoaded()
      })
    }
    const data = tickets.data?.tickets
    if (data === undefined) return
    if (syncedFor === gameId) return
    syncedFor = gameId
    untrack(() => {
      lotoStore.setRemoteTickets(data as LotoTicket[])
    })
  })
</script>

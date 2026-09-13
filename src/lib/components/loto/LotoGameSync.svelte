<script lang="ts">
  // Reactive subscription to backend game state (drawn numbers) for one
  // game instance. Mounted conditionally (only when a gameId exists) because
  // this convex-svelte version has no 'skip' support in useQuery.
  import { useQuery } from 'convex-svelte'
  import { untrack } from 'svelte'
  import { api } from '../../../../convex/_generated/api.js'
  import type { Id } from '../../../../convex/_generated/dataModel.js'
  import { getLotoStore } from '$lib/stores/lotoStore.svelte'

  let { gameId }: { gameId: string } = $props()

  const lotoStore = getLotoStore()
  const game = useQuery(api.loto.getGame, () => ({
    game_id: gameId as Id<'loto_games'>,
  }))

  $effect(() => {
    if (game.data !== undefined || game.error) {
      untrack(() => {
        lotoStore.markGameLoaded()
      })
    }
    const drawn = game.data?.drawn_numbers
    if (drawn) {
      untrack(() => {
        lotoStore.setDrawnNumbers(drawn)
      })
    }
    const createdAt = game.data?.created_at
    if (createdAt !== undefined) {
      untrack(() => {
        lotoStore.setGameCreatedAt(createdAt)
      })
    }
  })
</script>

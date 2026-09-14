<script lang="ts">
  // Reactive subscription to the backend ban list for the active channels.
  // Unlike tickets/game (which need a gameId and mount conditionally because
  // this convex-svelte version has no 'skip' support), this mounts always:
  // an empty channel list simply yields no bans.
  import { useQuery } from 'convex-svelte'
  import { untrack } from 'svelte'
  import { api } from '../../../../convex/_generated/api.js'
  import { getLotoStore } from '$lib/stores/lotoStore.svelte'

  let { channels }: { channels: string[] } = $props()

  const lotoStore = getLotoStore()
  const bans = useQuery(api.lotoBans.listBans, () => ({
    channels,
  }))

  $effect(() => {
    const data = bans.data?.bans
    if (data) {
      untrack(() => {
        lotoStore.setBans(data)
      })
    }
  })
</script>

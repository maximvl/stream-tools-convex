<script module lang="ts">
  import { createContext } from 'svelte'
  import type { SvelteMap as SvelteMapType } from 'svelte/reactivity'
  import type { ChatUser } from '$lib/types'

  export type RpsChatUsers = { users: SvelteMapType<string, ChatUser> }

  const [getRpsChatUsers, setRpsChatUsers] = createContext<RpsChatUsers>()

  export { getRpsChatUsers }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'
  import { fetchRpsChatUsers } from '$lib/rpsChat'

  let { channels, children }: { channels: string[]; children: Snippet } = $props()

  const state: RpsChatUsers = { users: new SvelteMap() }
  setRpsChatUsers(state)

  $effect(() => {
    const list = channels
    let cancelled = false
    const load = async () => {
      try {
        const fresh = await fetchRpsChatUsers(list)
        if (cancelled) return
        state.users.clear()
        for (const [k, v] of fresh) state.users.set(k, v)
      } catch {
        // keep stale profiles on transient errors
      }
    }
    void load()
    const timer = setInterval(load, 60000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  })
</script>

{@render children()}

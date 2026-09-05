<script lang="ts">
  // One reactive Convex auth subscription per chat connection.
  // Bootstrap is a single `api.auth.check` mutation (session verify + auth key
  // in one round trip); `authenticated` then stays live via the
  // `api.auth.isAuthenticated` subscription, flipping the moment chat-proof
  // confirm lands server-side.
  import { useConvexClient, useQuery } from 'convex-svelte'
  import { untrack } from 'svelte'
  import { api } from '../../../../convex/_generated/api.js'
  import { ensureSessionId, setSessionId } from '$lib/session'
  import type { ChatServer } from '$lib/types'
  import type { ConnKey } from '$lib/stores/chatMessagesStore.svelte'
  import type { AuthStore } from '$lib/stores/authStore.svelte'

  let { authStore, connKey }: { authStore: AuthStore; connKey: ConnKey } = $props()

  const convex = useConvexClient()

  const server = $derived(connKey.split('/')[0] as ChatServer)
  const channel = $derived(connKey.split('/')[1] as string)
  const stream_channel = $derived(`${server}/${channel}`)

  // Stable per-channel session. Resolved in an effect (not init) so the query
  // args stay reactive; until then the live query runs session-less.
  let sessionId = $state<string>()
  $effect(() => {
    const sc = stream_channel
    untrack(() => {
      sessionId = ensureSessionId(sc)
    })
  })

  type Boot = { authenticated: boolean; authKey?: string }
  let boot = $state<Boot>()
  let booting = $state(false)

  // One-shot bootstrap: verified session + fresh auth key in one call.
  $effect(() => {
    const sc = stream_channel
    const sid = sessionId
    if (!sid || boot || booting) return
    untrack(() => {
      booting = true
      convex
        .mutation(api.auth.check, { stream_channel: sc, session_id: sid })
        .then((res) => {
          setSessionId(sc, res.session_id)
          boot = res.authenticated
            ? { authenticated: true }
            : { authenticated: false, authKey: res.auth_key }
        })
        .catch(() => {
          // A later re-run retries the bootstrap.
          boot = undefined
        })
        .finally(() => {
          booting = false
        })
    })
  })

  // Live `authenticated` flag; re-runs server-side on every user_auth change.
  const live = useQuery(api.auth.isAuthenticated, () => ({
    stream_channel,
    session_id: sessionId ?? '',
  }))

  // Mirror into the shared registry for AuthDialog + LotoStore.isChannelAuthed.
  // Preserves isConfirming owned by confirmAuth.
  $effect(() => {
    const checking = booting || live.isLoading
    const authenticated = live.data?.authenticated ?? boot?.authenticated ?? false
    const authKey = !authenticated ? boot?.authKey : undefined
    untrack(() => {
      const prev = authStore.connectionInfo[connKey]
      authStore.connectionInfo[connKey] = {
        key: connKey,
        server,
        channel,
        authenticated,
        authKey,
        isChecking: checking,
        isConfirming: prev?.isConfirming ?? false,
      }
    })
  })

  // Prune on unmount so a removed channel leaves no stale auth behind.
  $effect(() => {
    return () => {
      untrack(() => {
        delete authStore.connectionInfo[connKey]
      })
    }
  })
</script>

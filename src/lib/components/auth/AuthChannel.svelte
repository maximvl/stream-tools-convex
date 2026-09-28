<script lang="ts">
  // One reactive Convex auth subscription per chat connection.
  // Bootstrap is a single `api.auth.check` mutation (session verify + auth key
  // in one round trip); `authenticated` then stays live via the
  // `api.auth.isAuthenticated` subscription, flipping the moment chat-proof
  // confirm lands server-side.
  import { useConvexClient, useQuery } from 'convex-svelte'
  import { untrack } from 'svelte'
  import { api } from '../../../../convex/_generated/api.js'
  import { getSessionId, mintSingleFlight, setSessionId } from '$lib/session'
  import { isValidConnKey } from '$lib/stores/chatMessagesStore.svelte'
  import type { ChatServer } from '$lib/types'
  import type { ConnKey } from '$lib/stores/chatMessagesStore.svelte'
  import type { AuthStore } from '$lib/stores/authStore.svelte'

  let { authStore, connKey }: { authStore: AuthStore; connKey: ConnKey } = $props()

  const convex = useConvexClient()

  const server = $derived(connKey.split('/')[0] as ChatServer)
  const channel = $derived(connKey.split('/')[1] as string)
  const stream_channel = $derived(`${server}/${channel}`)

  // Single browser-wide session shared by all channels, minted by the
  // backend only. Resolved in an effect (not init) so the query args stay
  // reactive; until then the live query runs session-less.
  let sessionId = $state<string>()
  $effect(() => {
    untrack(() => {
      sessionId = getSessionId()
    })
  })

  type Boot = { authenticated: boolean; authKey?: string }
  let boot = $state<Boot>()
  let booting = $state(false)

  // One-shot bootstrap: verified session + fresh auth key in one call. When
  // no session is stored yet the backend mints one (single-flight across all
  // mounted channels); afterwards this channel checks in under it.
  //
  // Retries are bounded with backoff: a failing check used to retry
  // immediately and forever (one tight mutation loop per channel — endless
  // console errors and backend hammering). Invalid channels never call at
  // all (the backend would reject them deterministically). The live
  // isAuthenticated subscription below keeps running regardless and is the
  // recovery path when the backend comes back.
  const BOOT_MAX_ATTEMPTS = 5
  const BOOT_RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000]
  let bootFailures = 0
  let bootDead = $state(false)

  $effect(() => {
    const sc = stream_channel
    if (boot || booting || bootDead) return
    if (!isValidConnKey(sc)) {
      untrack(() => {
        bootDead = true
      })
      return
    }
    untrack(() => {
      booting = true
      mintSingleFlight(async () => {
        const res = await convex.mutation(api.auth.check, {
          stream_channel: sc,
          session_id: getSessionId(),
        })
        return res.session_id
      })
        .then(async (sid) => {
          const res = await convex.mutation(api.auth.check, {
            stream_channel: sc,
            session_id: sid,
          })
          setSessionId(res.session_id)
          sessionId = res.session_id
          bootFailures = 0
          boot = res.authenticated
            ? { authenticated: true }
            : { authenticated: false, authKey: res.auth_key }
          booting = false
        })
        .catch(() => {
          // A later re-run retries the bootstrap, with backoff; after
          // BOOT_MAX_ATTEMPTS the loop stops (live query still recovers).
          boot = undefined
          bootFailures += 1
          if (bootFailures >= BOOT_MAX_ATTEMPTS) {
            bootDead = true
            booting = false
          } else {
            const delay =
              BOOT_RETRY_DELAYS_MS[Math.min(bootFailures - 1, BOOT_RETRY_DELAYS_MS.length - 1)] ??
              1000
            setTimeout(() => {
              booting = false
            }, delay)
          }
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

  // Prune on unmount so a removed channel leaves no stale auth behind,
  // and stop any pending bootstrap retry from re-arming on a dead component.
  $effect(() => {
    return () => {
      untrack(() => {
        bootDead = true
        delete authStore.connectionInfo[connKey]
      })
    }
  })
</script>

<script lang="ts">
  import { page } from '$app/state'
  import { useQuery } from 'convex-svelte'
  import { untrack } from 'svelte'
  import { api } from '../../../../convex/_generated/api.js'
  import Nav from '$lib/components/layout/Nav.svelte'
  import StreamerDashboard from '$lib/components/rps/StreamerDashboard.svelte'
  import ViewerPanel from '$lib/components/rps/ViewerPanel.svelte'
  import { getSessionId } from '$lib/session'
  import type { TournamentId } from '$lib/rps'

  const channel = $derived(page.params.channel ?? '')

  const tournament = useQuery(api.rps.getByOwnerChannel, () => ({ channel }))

  // Stored browser session (if any) — resolves owned channels for owner mode.
  // Viewers without a session get one minted inside ViewerPanel.
  let sessionId = $state<string>()
  $effect(() => {
    untrack(() => {
      sessionId = getSessionId()
    })
  })

  const owned = useQuery(api.authLib.channelsForSession, () => ({
    session_id: sessionId ?? '',
  }))

  const data = $derived(tournament.data ?? null)
  const tournamentId = $derived(data?.id as TournamentId | undefined)
  const isOwner = $derived(
    data !== null && (owned.data ?? []).some((c) => c.stream_channel === data.owner_stream_channel),
  )
</script>

<svelte:head>
  <title>{data ? `КНБ: ${channel}` : 'КНБ турнир'}</title>
</svelte:head>

<div class="dark flex min-h-screen flex-col items-center p-8">
  <Nav />

  {#if tournament.isLoading}
    <p class="mt-12 text-muted-foreground">Загрузка турнира…</p>
  {:else if !data || !tournamentId}
    <div class="mt-12 flex max-w-xl flex-col items-center gap-4 text-center">
      <h1 class="text-3xl font-extrabold">Нет живого турнира у «{channel}»</h1>
      <p class="text-muted-foreground">
        Турнир ещё не создан или уже завершён. Загляни в список активных.
      </p>
      <a href="/rps" class="font-bold text-primary hover:underline">Все турниры</a>
    </div>
  {:else if isOwner}
    <StreamerDashboard
      {tournamentId}
      tournament={data}
      ownedChannels={(owned.data ?? []).map((c) => c.stream_channel)}
    />
  {:else}
    <ViewerPanel {tournamentId} tournament={data} />
  {/if}
</div>

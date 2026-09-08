<script lang="ts">
  import { goto } from '$app/navigation'
  import { useConvexClient, useQuery } from 'convex-svelte'
  import { api } from '../../../../convex/_generated/api.js'
  import { Button } from '$lib/components/ui/button'
  import ServerIcon from '$lib/components/common/ServerIcon.svelte'
  import {
    createTournament,
    startTournament,
    tournamentHref,
    tournamentTitle,
    type TournamentId,
    type TournamentView,
  } from '$lib/rps'
  import RoundMatches from './RoundMatches.svelte'

  let {
    tournamentId,
    tournament,
    ownedChannels,
  }: {
    tournamentId: TournamentId
    tournament: TournamentView
    ownedChannels: string[]
  } = $props()

  const convex = useConvexClient()
  const roster = useQuery(api.rps.participants, () => ({ tournament_id: tournamentId }))

  const players = $derived(roster.data ?? [])
  // Backend-confirmed auth: the query only returns user_auth rows, so a
  // non-empty list means this browser proved at least one channel.
  const hasConfirmedAuth = $derived(ownedChannels.length > 0)
  const rounds = $derived(
    Array.from({ length: Math.max(tournament.current_round, 1) }, (_, i) => i + 1),
  )
  const winner = $derived(
    tournament.winner_participant_id === undefined
      ? null
      : (players.find((p) => p.id === tournament.winner_participant_id) ?? null),
  )

  let starting = $state(false)
  let startError = $state<string | null>(null)
  let creatingNext = $state(false)
  let nextError = $state<string | null>(null)

  async function onStart() {
    starting = true
    startError = null
    try {
      await startTournament(convex, tournamentId)
    } catch (e) {
      startError = e instanceof Error ? e.message : 'Failed to start'
    } finally {
      starting = false
    }
  }

  async function onNewTournament() {
    creatingNext = true
    nextError = null
    try {
      const res = await createTournament(convex)
      await goto(tournamentHref(res.owner_stream_channel))
    } catch (e) {
      nextError = e instanceof Error ? e.message : 'Не вышло создать турнир'
    } finally {
      creatingNext = false
    }
  }
</script>

<div class="flex w-full max-w-4xl flex-col gap-8">
  <div class="flex flex-col items-center gap-2 text-center">
    <h1 class="text-4xl font-extrabold tracking-tight">
      Турнир: {tournamentTitle(tournament.stream_channels)}
    </h1>
    <p class="text-sm text-muted-foreground">{tournament.stream_channels.join(' · ')}</p>
    <span
      class="rounded-full px-3 py-1 text-xs font-bold tracking-widest uppercase {tournament.status ===
      'registration'
        ? 'bg-green-500/20 text-green-400'
        : tournament.status === 'running'
          ? 'bg-amber-500/20 text-amber-300'
          : 'bg-primary/20 text-primary'}"
    >
      {tournament.status === 'registration'
        ? 'Регистрация'
        : tournament.status === 'running'
          ? `Раунд ${tournament.current_round}`
          : 'Завершён'}
    </span>
  </div>

  {#if tournament.status === 'finished'}
    <div
      class="flex flex-col items-center gap-4 rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-8 text-center"
    >
      {#if winner}
        <div>
          <p class="text-sm tracking-widest text-muted-foreground uppercase">Победитель</p>
          <p class="mt-1 text-3xl font-black text-yellow-400 uppercase">{winner.display_name}</p>
          <p class="mt-1 text-sm text-muted-foreground">{winner.wins} побед</p>
        </div>
      {:else if tournament.winner_display_name}
        <div>
          <p class="text-sm tracking-widest text-muted-foreground uppercase">Победитель</p>
          <p class="mt-1 text-3xl font-black text-yellow-400 uppercase">
            {tournament.winner_display_name}
          </p>
        </div>
      {:else}
        <p class="text-2xl font-black">Никто не выжил — победителя нет</p>
      {/if}
      <Button
        class="rounded-2xl bg-green-600 px-10 py-5 text-lg font-black tracking-tighter uppercase shadow-xl transition-all hover:scale-105 hover:bg-green-500 active:scale-95 disabled:opacity-50"
        onclick={onNewTournament}
        disabled={creatingNext || !hasConfirmedAuth}
      >
        {creatingNext ? 'Создаём…' : 'Новый турнир'}
      </Button>
      {#if nextError}
        <p class="text-sm text-red-500">{nextError}</p>
      {:else if !hasConfirmedAuth}
        <p class="text-sm text-amber-400">
          Подтверди аккаунт хотя бы одного канала (код в чат), чтобы создать турнир.
        </p>
      {/if}
    </div>
  {/if}

  {#if tournament.status === 'registration'}
    <div class="flex flex-col items-center gap-3">
      <Button
        class="rounded-2xl bg-green-600 px-12 py-6 text-xl font-black tracking-tighter uppercase shadow-xl transition-all hover:scale-105 hover:bg-green-500 active:scale-95 disabled:opacity-50"
        onclick={onStart}
        disabled={starting || players.length === 0 || !hasConfirmedAuth}
      >
        {starting ? 'Запускаем…' : `Начать (${players.length})`}
      </Button>
      {#if startError}
        <p class="text-sm text-red-500">{startError}</p>
      {:else if !hasConfirmedAuth}
        <p class="text-sm text-amber-400">
          Подтверди аккаунт хотя бы одного канала (код в чат), чтобы запустить турнир.
        </p>
      {:else}
        <p class="text-sm text-muted-foreground">
          Зрители вступают через страницу турнира: получают код и жмут «Вступить».
        </p>
      {/if}
    </div>

    <div>
      <h2 class="mb-3 text-2xl font-bold">Участники: {players.length}</h2>
      {#if roster.isLoading}
        <p class="text-muted-foreground">Загрузка…</p>
      {:else if players.length === 0}
        <div class="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Пока никто не зарегистрировался. Зрители вступают со страницы турнира.
        </div>
      {:else}
        <div class="flex flex-wrap justify-center gap-3">
          {#each players as p (p.id as string)}
            <div class="flex items-center gap-2 rounded-xl border bg-card px-4 py-2">
              <ServerIcon server={p.platform} status="connected" class="h-5 w-5" disableTooltip />
              <span class="font-bold">{p.display_name}</span>
              <span class="text-xs text-muted-foreground">{p.via_stream_channel}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="flex flex-col gap-8">
      {#each rounds.slice().reverse() as r (r)}
        <RoundMatches {tournamentId} round={r} />
      {/each}
    </div>
  {/if}
</div>

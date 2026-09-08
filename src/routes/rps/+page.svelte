<script lang="ts">
  import { goto } from '$app/navigation'
  import { useConvexClient, useQuery } from 'convex-svelte'
  import { untrack } from 'svelte'
  import { api } from '../../../convex/_generated/api.js'
  import AuthDialog from '$lib/components/auth/AuthDialog.svelte'
  import ConnectionDialog from '$lib/components/connections/ConnectionDialog.svelte'
  import Nav from '$lib/components/layout/Nav.svelte'
  import { Button } from '$lib/components/ui/button'
  import { getChatStore } from '$lib/context'
  import { createTournament, tournamentHref, tournamentTitle } from '$lib/rps'
  import { AuthStore } from '$lib/stores/authStore.svelte'

  const convex = useConvexClient()
  const chatStore = getChatStore()
  const authStore = new AuthStore()

  $effect(() => {
    untrack(() => {
      authStore.connections.length = 0
    })
    chatStore.connections.value.forEach((c) => {
      untrack(() => authStore.add(c))
    })
  })

  const tournaments = useQuery(api.rps.list, () => ({}))

  let creating = $state(false)
  let createError = $state<string | null>(null)

  async function onCreate() {
    creating = true
    createError = null
    try {
      const res = await createTournament(convex)
      await goto(tournamentHref(res.owner_stream_channel))
    } catch (e) {
      createError = e instanceof Error ? e.message : 'Failed to create tournament'
    } finally {
      creating = false
    }
  }

  const items = $derived(tournaments.data ?? [])
</script>

<svelte:head>
  <title>КНБ турниры</title>
</svelte:head>

<div class="dark flex min-h-screen flex-col items-center p-8">
  <Nav />

  <div class="mb-12 flex w-full max-w-6xl items-center">
    <div class="w-[250px]">
      <ConnectionDialog />
    </div>
    <div class="flex-1 text-center">
      <h1 class="text-4xl font-extrabold tracking-tight">Камень-ножницы-бумага</h1>
      <p class="mt-2 text-muted-foreground">Турниры на выбывание со зрителями</p>
    </div>
    <div class="flex w-[250px] justify-end">
      <AuthDialog {authStore} />
    </div>
  </div>

  <div class="flex w-full max-w-2xl flex-col items-center gap-3">
    <Button
      class="w-full rounded-2xl bg-green-600 py-6 text-lg font-black shadow-xl transition-all hover:scale-105 hover:bg-green-500 active:scale-95 disabled:opacity-50"
      onclick={onCreate}
      disabled={creating}
    >
      {creating ? 'Создаём…' : 'Создать турнир'}
    </Button>
    {#if createError}
      <p class="text-sm text-red-500">
        {createError} — подключи чаты своих каналов и подтверди аккаунт.
      </p>
    {:else}
      <p class="text-sm text-muted-foreground">
        Турнир создаётся на твои подтверждённые каналы. Зрители увидят его в списке ниже.
      </p>
    {/if}
  </div>

  <div class="mt-12 flex w-full max-w-4xl flex-col gap-4">
    <h2 class="text-2xl font-bold">Турниры</h2>
    {#if tournaments.isLoading}
      <p class="text-muted-foreground">Загрузка…</p>
    {:else if items.length === 0}
      <div class="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Пока нет активных турниров. Создай первый!
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {#each items as t (t.id)}
          {@const owner = t.owner_stream_channel}
          <a
            href={tournamentHref(owner)}
            class="group flex flex-col gap-2 rounded-3xl border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10"
          >
            <div class="flex items-center justify-between">
              <span class="text-xl font-bold">{tournamentTitle(t.stream_channels)}</span>
              <span
                class="rounded-full px-3 py-1 text-xs font-bold tracking-widest uppercase {t.status ===
                'registration'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-amber-500/20 text-amber-300'}"
              >
                {t.status === 'registration' ? 'Регистрация' : `Раунд ${t.current_round}`}
              </span>
            </div>
            <div class="text-sm text-muted-foreground">
              {t.stream_channels.join(' · ')}
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>

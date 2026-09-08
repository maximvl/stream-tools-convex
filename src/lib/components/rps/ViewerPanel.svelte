<script lang="ts">
  import { useConvexClient, useQuery } from 'convex-svelte'
  import { untrack } from 'svelte'
  import { api } from '../../../../convex/_generated/api.js'
  import { Button } from '$lib/components/ui/button'
  import { getSessionId } from '$lib/session'
  import {
    confirmViewerCodeWithRetry,
    ensureRpsSession,
    joinTournament,
    requestViewerCode,
    tournamentTitle,
    type BoardMatchView,
    type MyEntryView,
    type RpsProof,
    type TournamentId,
    type TournamentView,
  } from '$lib/rps'
  import MoveBoard from './MoveBoard.svelte'
  import RoundMatches from './RoundMatches.svelte'

  let {
    tournamentId,
    tournament,
  }: {
    tournamentId: TournamentId
    tournament: TournamentView
  } = $props()

  const convex = useConvexClient()

  let sessionId = $state<string>()
  $effect(() => {
    untrack(() => {
      const stored = getSessionId()
      if (stored) {
        sessionId = stored
      } else {
        void ensureRpsSession(convex)
          .then((s) => {
            sessionId = s
          })
          .catch(() => {})
      }
    })
  })

  const entriesQuery = useQuery(api.rps.myEntries, () => ({
    tournament_id: tournamentId,
    viewer_session_id: sessionId ?? '',
  }))
  const boardsQuery = useQuery(api.rpsMatches.myMatches, () => ({
    tournament_id: tournamentId,
    viewer_session_id: sessionId ?? '',
  }))

  const entries = $derived((entriesQuery.data ?? []) as MyEntryView[])
  const boards = $derived((boardsQuery.data ?? []) as BoardMatchView[])
  const joined = $derived(entries.length > 0)

  // Session-level auth: any user_auth rows for this browser (returning
  // viewer, authed elsewhere). Authed sessions skip the code flow entirely
  // and join on page load.
  const sessionAuthQuery = useQuery(api.authLib.channelsForSession, () => ({
    session_id: sessionId ?? '',
  }))
  const hasSessionAuth = $derived((sessionAuthQuery.data ?? []).length > 0)
  const authLoaded = $derived(sessionId !== undefined && !sessionAuthQuery.isLoading)

  // Chats of this tournament the viewer hasn't registered through yet.
  // The code panel stays visible while any remain; hides once all covered.
  const coveredChats = $derived(new Set(entries.map((e) => e.via_stream_channel)))
  const uncoveredChats = $derived(tournament.stream_channels.filter((c) => !coveredChats.has(c)))

  const grouped = $derived.by(() => {
    const map = new Map<string, { entry: MyEntryView; matches: BoardMatchView[] }>()
    for (const entry of entries) {
      map.set(entry.id as string, { entry, matches: [] })
    }
    for (const m of boards) {
      const key = m.me?.id as string | undefined
      if (!key) continue
      const g = map.get(key)
      if (g) g.matches.push(m)
      else if (m.me) {
        // Entry row missing (edge) — still show the board.
        map.set(key, {
          entry: {
            id: m.me.id,
            platform: m.me.platform,
            user_slug: m.me.user_slug,
            display_name: m.me.display_name,
            via_stream_channel: m.me.via_stream_channel,
            wins: m.me.wins,
            status: 'active',
            is_bot: false,
          },
          matches: [m],
        })
      }
    }
    return [...map.values()]
  })

  let code = $state<string | null>(null)
  let codeLoading = $state(false)
  let codeError = $state<string | null>(null)
  let codeRequested = $state(false)
  let proofs = $state<RpsProof[]>([])
  let confirming = $state(false)
  let confirmNote = $state<string | null>(null)
  let joining = $state(false)
  let joinError = $state<string | null>(null)
  let copied = $state(false)

  // Authed sessions join on page load — no code needed. Runs once, only
  // while registration is open and entries are still missing.
  let autoJoinTried = $state(false)
  $effect(() => {
    const s = sessionId
    if (!s || !authLoaded || autoJoinTried || !hasSessionAuth || joined) return
    if (tournament.status !== 'registration') return
    untrack(() => {
      autoJoinTried = true
      void autoJoin()
    })
  })

  // The copy-code button shows right away for sessions without auth: fetch
  // the code as soon as the session is ready, no extra click needed.
  $effect(() => {
    const s = sessionId
    if (!s || !authLoaded || codeRequested || hasSessionAuth) return
    untrack(() => {
      codeRequested = true
      void fetchCode(s)
    })
  })

  async function fetchCode(s: string) {
    codeLoading = true
    codeError = null
    joinError = null
    try {
      const res = await requestViewerCode(convex, tournamentId, s)
      code = res.auth_key
      proofs = []
      void pollConfirm()
    } catch (e) {
      codeError = e instanceof Error ? e.message : 'Не вышло получить код'
    } finally {
      codeLoading = false
    }
  }

  function retryCode() {
    codeRequested = false
  }

  async function pollConfirm() {
    if (!sessionId || confirming) return
    confirming = true
    confirmNote = null
    try {
      const res = await confirmViewerCodeWithRetry(convex, tournamentId, sessionId, 12, 5000)
      proofs = res.proofs
      if (res.authenticated && proofs.length > 0) {
        // Code spotted in chat — register entries automatically, no extra click.
        await autoJoin()
      } else if (!res.authenticated) {
        confirmNote = 'Код в чате пока не найден — отправь его и нажми «Проверить».'
      }
    } catch {
      confirmNote = 'Проверка не удалась — попробуй ещё раз.'
    } finally {
      confirming = false
    }
  }

  async function copyCode() {
    if (!code) return
    await navigator.clipboard.writeText(`+мой ${code}`)
    copied = true
    setTimeout(() => {
      copied = false
    }, 2000)
  }

  async function autoJoin() {
    if (!sessionId || joining) return
    joining = true
    joinError = null
    try {
      await joinTournament(convex, tournamentId, sessionId)
    } catch (e) {
      joinError = e instanceof Error ? e.message : 'Не вышло вступить'
    } finally {
      joining = false
    }
  }

  // Manual fallback if auto-join failed.
  async function onJoin() {
    await autoJoin()
  }
</script>

<div class="flex w-full max-w-4xl flex-col gap-8">
  <div class="flex flex-col items-center gap-2 text-center">
    <h1 class="text-4xl font-extrabold tracking-tight">
      Турнир на стриме {tournamentTitle(tournament.stream_channels)}
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

  {#if !joined}
    {#if tournament.status === 'registration'}
      {#if hasSessionAuth && !joinError}
        <div
          class="mx-auto flex w-full max-w-xl flex-col items-center gap-2 rounded-3xl border bg-card p-6 text-center"
        >
          <p class="text-lg font-bold">Зареган в турнирe</p>
        </div>
      {:else}
        <div class="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-3xl border bg-card p-6">
          {#if codeLoading && !code}
            <p class="text-center text-muted-foreground">Готовим код…</p>
          {:else if codeError && !code}
            <p class="text-center text-sm text-red-500">{codeError}</p>
            <Button variant="outline" class="w-full" onclick={retryCode}>Попробовать снова</Button>
          {:else if code}
            <p class="text-center text-muted-foreground">
              Чтобы вступить, отправь код в чат стримера. Можно отправить в несколько чатов —
              получишь несколько участников и будешь играть одновременно.
            </p>
            <div class="flex flex-col items-center gap-2 text-center">
              <p class="text-muted-foreground">Отправь в чат стримера:</p>
              <button
                class="cursor-pointer rounded-2xl border border-primary/40 bg-primary/10 px-8 py-4 text-2xl font-black tracking-widest transition-all hover:scale-105"
                onclick={copyCode}
              >
                +мой {code}
              </button>
              <p class="text-xs text-muted-foreground">
                {copied ? 'Скопировано!' : 'Нажми чтобы скопировать'} · чаты: {tournament.stream_channels.join(
                  ', ',
                )}
              </p>
            </div>
            <Button variant="outline" class="w-full" onclick={pollConfirm} disabled={confirming}>
              {confirming
                ? 'Проверяем чат…'
                : proofs.length > 0
                  ? 'Проверить ещё раз'
                  : 'Проверить'}
            </Button>
            {#if confirmNote}
              <p class="text-center text-sm text-muted-foreground">{confirmNote}</p>
            {/if}
            {#if proofs.length > 0}
              <div class="flex flex-col gap-2">
                <p class="text-center font-bold text-green-400">
                  Найдено в чате: {proofs.length} — {proofs
                    .map((p) => `${p.display_name} (${p.via_stream_channel})`)
                    .join(', ')}
                </p>
                {#if joining}
                  <p class="text-center text-sm text-muted-foreground">Регистрируем…</p>
                {:else if joinError}
                  <p class="text-center text-sm text-red-500">{joinError}</p>
                  <Button variant="outline" class="w-full" onclick={onJoin}>
                    Попробовать вступить ещё раз
                  </Button>
                {/if}
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    {:else}
      <div class="mx-auto w-full max-w-xl rounded-3xl border bg-card p-6 text-center">
        <p class="text-lg font-bold">Регистрация закрыта — турнир идёт</p>
        <p class="mt-1 text-sm text-muted-foreground">Смотри бои ниже.</p>
      </div>
      <RoundMatches {tournamentId} round={tournament.current_round} />
    {/if}
  {:else}
    <div class="flex flex-col gap-6">
      {#if tournament.status === 'finished'}
        {@const myChamp = entries.some((e) => e.status === 'champion')}
        <div class="rounded-3xl border border-yellow-500/40 bg-yellow-500/10 p-6 text-center">
          {#if myChamp}
            <p class="text-3xl font-black text-yellow-400 uppercase">Ты — чемпион! 🏆</p>
          {:else if tournament.winner_display_name}
            <p class="text-sm tracking-widest text-muted-foreground uppercase">Победитель</p>
            <p class="mt-1 text-2xl font-black text-yellow-400 uppercase">
              {tournament.winner_display_name}
            </p>
          {:else}
            <p class="text-2xl font-black">Никто не выжил — победителя нет</p>
          {/if}
        </div>
      {/if}
      {#each grouped as g (g.entry.id as string)}
        {#if sessionId}
          <MoveBoard entry={g.entry} matches={g.matches} {sessionId} />
        {/if}
      {/each}
      {#if tournament.status === 'registration'}
        <p class="text-center text-sm text-muted-foreground">
          Ты зарегистрирован: {entries
            .map((e) => `${e.display_name} (чат ${e.via_stream_channel})`)
            .join(', ')}. Турнир начнётся, когда стример нажмёт «Начать».
        </p>
        {#if uncoveredChats.length > 0}
          <div class="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-3xl border bg-card p-6">
            <p class="text-center text-sm text-muted-foreground">
              Без регистрации: {uncoveredChats.join(', ')}. Отправь тот же код туда и получишь ещё
              участников.
            </p>
            {#if codeLoading && !code}
              <p class="text-center text-sm text-muted-foreground">Готовим код…</p>
            {:else if codeError && !code}
              <p class="text-center text-sm text-red-500">{codeError}</p>
              <Button variant="outline" class="w-full" onclick={retryCode}>
                Попробовать снова
              </Button>
            {:else if code}
              <button
                class="cursor-pointer rounded-2xl border border-primary/40 bg-primary/10 px-8 py-4 text-2xl font-black tracking-widest transition-all hover:scale-105"
                onclick={copyCode}
              >
                +мой {code}
              </button>
              <Button
                variant="outline"
                class="w-full"
                onclick={pollConfirm}
                disabled={confirming || joining}
              >
                {confirming ? 'Проверяем чат…' : joining ? 'Регистрируем…' : 'Проверить новые чаты'}
              </Button>
              {#if joinError}
                <p class="text-center text-sm text-red-500">{joinError}</p>
              {/if}
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

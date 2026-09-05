<script lang="ts">
  import Nav from '$lib/components/layout/Nav.svelte'
  import { Button } from '$lib/components/ui/button'
  import PhaserCanvas from './PhaserCanvas.svelte'
  import type { HexPlayer } from '$lib/phaser/MainScene'
  import { getChatStore } from '$lib/context'
  import { VkColorsMap } from '$lib/constants'
  import { untrack } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import type { ChatUser, ChatServer, UserId } from '$lib/types'
  import ConnectionDialog from '$lib/components/connections/ConnectionDialog.svelte'
  import KickModeratorIcon from '$lib/components/loto/KickModeratorIcon.svelte'
  import ServerIcon from '$lib/components/common/ServerIcon.svelte'
  import { createFrontendLogs } from '$lib/api/loto'

  let canvasComponent: PhaserCanvas | null = $state(null)
  let players: HexPlayer[] = $state([])
  let alive = $state(0)
  let turn = $state(0)
  let isFiring = $state(false)
  let winner: string | null = $state(null)
  let winnerPlayer: HexPlayer | null = $state(null)
  let nextElim = $state(0)
  let gameStarted = $state(false)
  let shielded = $state(0)
  let dead = $state(0)
  let cooldownRemaining = $state(0)
  let cooldownTimer: ReturnType<typeof setInterval> | null = null
  const COOLDOWN_SECONDS = 20
  let winnerChatOpen = $state(false)
  let winnerChatContainer: HTMLDivElement | null = $state(null)

  const winnerMessages = $derived.by(() => {
    if (!winnerPlayer) return []
    const id = winnerPlayer.id as UserId
    const chatId = winnerPlayer.chatUser?.id
    const msgs =
      chatStore.messagesByUser.get(id) ??
      (chatId ? chatStore.messagesByUser.get(chatId) : undefined) ??
      []
    return [...msgs].sort((a, b) => a.timestampMs - b.timestampMs)
  })
  const winnerMessagesAmount = $derived(winnerMessages.length)

  $effect(() => {
    void winnerMessagesAmount
    if (winnerChatContainer) {
      winnerChatContainer.scrollTop = winnerChatContainer.scrollHeight
    }
  })

  $effect(() => {
    // close chat when winner cleared
    if (!winnerPlayer) winnerChatOpen = false
  })

  const chatStore = getChatStore()
  const addedChatIds = new SvelteSet<string>()
  let pendingChatPlayers: HexPlayer[] = $state([])

  function chatUserColor(user: ChatUser): string {
    if (user.twitchFields?.color) return user.twitchFields.color
    if (user.vkFields?.nickColor !== undefined)
      return VkColorsMap[user.vkFields.nickColor] ?? '#D66E34'
    if (user.kickFields?.color) return user.kickFields.color
    if (user.wtvFields?.nicknameColor) return user.wtvFields.nicknameColor
    // fallback hash to palette
    const palette = [
      '#22d3ee',
      '#facc15',
      '#f87171',
      '#4ade80',
      '#a78bfa',
      '#fb923c',
      '#38bdf8',
      '#f472b6',
      '#34d399',
      '#fbbf24',
      '#60a5fa',
      '#e879f9',
    ]
    let h = 0
    for (let i = 0; i < user.id.length; i++) h = (h * 31 + user.id.charCodeAt(i)) >>> 0
    return palette[h % palette.length]
  }

  function chatUserToHexPlayer(user: ChatUser, platform?: ChatServer): HexPlayer {
    return {
      id: user.id as string,
      name: user.displayName,
      color: chatUserColor(user),
      platform: platform as ChatServer | undefined,
      chatUser: user,
    }
  }

  function winnerBadge(): { url: string; title: string } | null {
    const user = winnerPlayer?.chatUser
    if (!user) return null
    const twitchBadges = user.twitchFields?.badges || []
    if (twitchBadges.length > 0 && twitchBadges[0].imageUrl)
      return { url: twitchBadges[0].imageUrl, title: twitchBadges[0].title }
    const vkRoles = user.vkFields?.roles || []
    if (vkRoles.length > 0) {
      const highest = vkRoles.reduce((a, c) => (c.priority > a.priority ? c : a))
      if (highest.largeUrl) return { url: highest.largeUrl, title: highest.name }
    }
    const vkBadges = user.vkFields?.badges || []
    if (vkBadges.length > 0 && vkBadges[0].largeUrl)
      return { url: vkBadges[0].largeUrl, title: vkBadges[0].name }
    const kickBadges = user.kickFields?.badges || []
    const kickMod = kickBadges.find((b) => b.type === 'moderator')
    if (kickMod) return { url: '__kick_mod__', title: kickMod.name }
    const kickBadge = kickBadges.find((b) => b.imageUrl)
    if (kickBadge?.imageUrl) return { url: kickBadge.imageUrl, title: kickBadge.name }
    return null
  }

  const winnerBadgeInfo = $derived.by(() => winnerBadge())

  function eliminationWord(n: number): string {
    const mod10 = n % 10
    const mod100 = n % 100
    if (mod100 >= 11 && mod100 <= 14) return 'игроков'
    if (mod10 === 1) return 'игрок'
    if (mod10 >= 2 && mod10 <= 4) return 'игрока'
    return 'игроков'
  }

  function startNewGameCooldown() {
    if (cooldownTimer) clearInterval(cooldownTimer)
    cooldownRemaining = COOLDOWN_SECONDS
    cooldownTimer = setInterval(() => {
      cooldownRemaining -= 1
      if (cooldownRemaining <= 0) {
        cooldownRemaining = 0
        if (cooldownTimer) clearInterval(cooldownTimer)
        cooldownTimer = null
      }
    }, 1000)
  }

  function clearCooldown() {
    if (cooldownTimer) clearInterval(cooldownTimer)
    cooldownTimer = null
    cooldownRemaining = 0
  }

  function flushPending() {
    if (pendingChatPlayers.length === 0) return
    const sc = canvasComponent?.getScene()
    if (!sc || sc.isEliminating() || sc.getGameStarted()) return
    const toAdd = [...pendingChatPlayers]
    pendingChatPlayers = []
    sc.addPlayers(toAdd)
    handleSceneReady()
  }

  // watch chat for +игра — each user only once, locked after first fire
  $effect(() => {
    const msgs = chatStore.newMessages
    untrack(() => {
      const sc = canvasComponent?.getScene()
      if (sc?.getGameStarted() || gameStarted) return
      const toAdd: HexPlayer[] = []
      for (const m of msgs) {
        const t = m.text.trim().toLowerCase()
        if (t !== '+игра') continue
        const uid = m.user.id as string
        if (addedChatIds.has(uid)) continue
        if (toAdd.some((p) => p.id === uid)) continue
        addedChatIds.add(uid)
        toAdd.push(
          chatUserToHexPlayer(
            m.user,
            (m as unknown as { source?: { server: ChatServer } }).source?.server,
          ),
        )
      }
      if (toAdd.length > 0) {
        if (!sc) {
          pendingChatPlayers.push(...toAdd)
        } else if (sc.isEliminating() || sc.getGameStarted()) {
          pendingChatPlayers.push(...toAdd)
        } else {
          sc.addPlayers(toAdd)
          players = sc.getPlayers()
          alive = sc.getAliveCount()
          nextElim = sc.getNextEliminationCount()
        }
      }
    })
  })

  // also on mount, seed from existing history (messages already fetched)
  $effect(() => {
    void chatStore.messages.length
    untrack(() => {
      const sc = canvasComponent?.getScene()
      if (!sc || sc.getGameStarted() || gameStarted) return
      const historyToAdd: HexPlayer[] = []
      for (const m of chatStore.messages) {
        if (m.text.trim().toLowerCase() !== '+игра') continue
        const uid = m.user.id as string
        if (addedChatIds.has(uid)) continue
        if (historyToAdd.some((p) => p.id === uid)) continue
        if (sc.getPlayers().some((p) => p.id === uid)) {
          addedChatIds.add(uid)
          continue
        }
        addedChatIds.add(uid)
        historyToAdd.push(
          chatUserToHexPlayer(
            m.user,
            (m as unknown as { source?: { server: ChatServer } }).source?.server,
          ),
        )
      }
      if (historyToAdd.length > 0) {
        if (sc.isEliminating() || sc.getGameStarted()) pendingChatPlayers.push(...historyToAdd)
        else {
          sc.addPlayers(historyToAdd)
          handleSceneReady()
        }
      }
    })
  })

  // flush pending when firing finishes
  $effect(() => {
    void isFiring
    untrack(() => {
      if (!isFiring) flushPending()
    })
  })

  function handleResurrect() {
    if (winner && cooldownRemaining > 0) return
    if (isFiring || winner) return
    const sc = canvasComponent?.getScene()
    if (!sc || sc.getDeadCount() === 0) return
    const n = canvasComponent?.resurrect() ?? 0
    if (n > 0) {
      // sync from scene
      setTimeout(handleSceneReady, 120)
    }
  }

  function handleShield() {
    if (winner && cooldownRemaining > 0) return
    if (isFiring || winner) return
    const sc = canvasComponent?.getScene()
    if (!sc || sc.getAliveCount() === 0) return
    const n = canvasComponent?.shield() ?? 0
    if (n > 0) {
      setTimeout(handleSceneReady, 120)
    }
  }

  function handleFire() {
    if (winner) {
      if (cooldownRemaining > 0) return
      handleNewGame()
      return
    }
    if (isFiring) return
    const sc = canvasComponent?.getScene()
    if (sc && !sc.getGameStarted() && pendingChatPlayers.length > 0) {
      flushPending()
    }
    const wasStarted = sc?.getGameStarted() ?? gameStarted
    canvasComponent?.fire()
    const nowStarted = canvasComponent?.getScene()?.getGameStarted() ?? true
    gameStarted = nowStarted
    if (!wasStarted && nowStarted) {
      pendingChatPlayers = []
      // first fire = game start — send frontend log (empty response expected)
      const totalNow = canvasComponent?.getScene()?.getPlayers().length ?? players.length
      createFrontendLogs([`Game started: fire pressed, players=${totalNow}`]).catch(() => {})
    }
  }

  function handleSceneReady() {
    const sc = canvasComponent?.getScene()
    if (!sc) return
    players = sc.getPlayers()
    alive = sc.getAliveCount()
    turn = sc.getCurrentTurn()
    isFiring = sc.isEliminating()
    gameStarted = sc.getGameStarted()
    nextElim = sc.getNextEliminationCount()
    shielded = sc.getShieldedCount()
    dead = sc.getDeadCount()
    // attach listeners once
    sc.events.off('turn')
    sc.events.off('gameover')
    sc.events.off('gamestarted')
    sc.events.off('fireEnd')
    sc.events.off('firingEnd')
    sc.events.off('shield')
    sc.events.off('resurrect')
    sc.events.off('shieldBreak')
    const syncFromScene = () => {
      isFiring = sc.isEliminating()
      alive = sc.getAliveCount()
      turn = sc.getCurrentTurn()
      gameStarted = sc.getGameStarted()
      nextElim = sc.getNextEliminationCount()
      shielded = sc.getShieldedCount()
      dead = sc.getDeadCount()
    }
    sc.events.on('turn', (e: { turn: number; alive: number }) => {
      turn = e.turn
      alive = e.alive
      isFiring = sc.isEliminating()
      gameStarted = sc.getGameStarted()
      nextElim = sc.getNextEliminationCount()
    })
    sc.events.on('fireEnd', syncFromScene)
    sc.events.on('firingEnd', syncFromScene)
    sc.events.on('shield', syncFromScene)
    sc.events.on('resurrect', syncFromScene)
    sc.events.on('shieldBreak', syncFromScene)
    sc.events.on('gameover', (e: { winner?: HexPlayer }) => {
      winnerPlayer = e.winner ?? null
      winner = e.winner?.name ?? '—'
      isFiring = false
      gameStarted = sc.getGameStarted()
      alive = sc.getAliveCount()
      shielded = sc.getShieldedCount()
      dead = sc.getDeadCount()
      nextElim = sc.getNextEliminationCount()
      startNewGameCooldown()
    })
    sc.events.on('gamestarted', () => {
      gameStarted = true
      pendingChatPlayers = []
    })
  }

  // robust polling — keeps Svelte in sync even if events missed
  $effect(() => {
    const id = setInterval(() => {
      const sc = canvasComponent?.getScene()
      if (!sc) return
      const firing = sc.isEliminating()
      if (firing !== isFiring) isFiring = firing
      const gs = sc.getGameStarted()
      if (gs !== gameStarted) gameStarted = gs
      const a = sc.getAliveCount()
      if (a !== alive) alive = a
      const t = sc.getCurrentTurn()
      if (t !== turn) turn = t
      const ne = sc.getNextEliminationCount()
      if (ne !== nextElim) nextElim = ne
      const sh = sc.getShieldedCount()
      if (sh !== shielded) shielded = sh
      const d = sc.getDeadCount()
      if (d !== dead) dead = d
      if (winnerPlayer && a > 1) {
        winner = null
        winnerPlayer = null
        clearCooldown()
      }
      if (!firing && !gs && pendingChatPlayers.length > 0) flushPending()
    }, 100)
    return () => clearInterval(id)
  })

  // capture players after mount
  $effect(() => {
    const id = setTimeout(handleSceneReady, 900)
    return () => clearTimeout(id)
  })

  function reshuffle() {
    // just move same roster to new hexes — no new players, no reset of join lock
    if (isFiring) return
    canvasComponent?.reshuffle()
    setTimeout(handleSceneReady, 220)
  }

  function handleNewGame() {
    if (cooldownRemaining > 0) return
    clearCooldown()
    winner = null
    winnerPlayer = null
    winnerChatOpen = false
    isFiring = false
    gameStarted = false
    addedChatIds.clear()
    pendingChatPlayers = []
    canvasComponent?.newGame()
    setTimeout(handleSceneReady, 250)
  }

  function handleClearPlayers() {
    clearCooldown()
    winner = null
    winnerPlayer = null
    winnerChatOpen = false
    isFiring = false
    gameStarted = false
    addedChatIds.clear()
    pendingChatPlayers = []
    canvasComponent?.clearPlayers()
    setTimeout(handleSceneReady, 250)
  }

  // cleanup cooldown timer on destroy
  $effect(() => {
    return () => {
      if (cooldownTimer) clearInterval(cooldownTimer)
    }
  })
</script>

<svelte:head>
  <title>Game - Hex Field</title>
</svelte:head>

<div class="dark flex h-[100dvh] flex-col overflow-hidden bg-[#0a0a1a]">
  <!-- Navigation bar: only element apart from game field -->
  <div class="flex shrink-0 flex-col items-center px-4 pt-4">
    <Nav />
  </div>

  <!-- Game field takes rest of page -->
  <div class="relative flex min-h-0 flex-1 flex-col">
    <PhaserCanvas bind:this={canvasComponent} />

    <!-- Floating game actions panel -->
    <div class="pointer-events-none absolute inset-0 flex items-end justify-center p-4 sm:p-6">
      <div class="pointer-events-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {#if !winner}
          <Button
            class="rounded-full px-4 py-5 text-sm font-bold shadow-lg disabled:opacity-50 sm:px-6 sm:text-base"
            variant="secondary"
            onclick={handleResurrect}
            disabled={isFiring || dead === 0 || nextElim === 0}
            title="Воскресить {nextElim} {eliminationWord(nextElim)}"
          >
            <span class="inline-flex items-center gap-1.5">
              <span>♻️</span>
              <span class="hidden sm:inline">Воскресить</span>
              <span class="sm:hidden">Воскрес</span>
              {#if nextElim > 0 && dead > 0}
                <span
                  class="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs leading-none font-black text-emerald-200"
                  >+{Math.min(nextElim, dead)}</span
                >
              {/if}
            </span>
          </Button>
        {/if}

        <Button
          class="rounded-full px-8 py-6 text-lg font-black shadow-xl shadow-orange-500/20 disabled:opacity-60 sm:px-10"
          variant="default"
          onclick={handleFire}
          disabled={isFiring ||
            (!winner && alive === 0 && pendingChatPlayers.length === 0) ||
            (!!winner && cooldownRemaining > 0)}
        >
          {#if winner}
            {#if cooldownRemaining > 0}
              Новая игра ({cooldownRemaining})
            {:else}
              Новая игра
            {/if}
          {:else if isFiring}
            Падает огонь…
          {:else}
            <span class="inline-flex items-center gap-2">
              <span>🔥 Огонь</span>
              {#if nextElim > 0}
                <span class="rounded-full bg-white/15 py-0.5 leading-none font-bold">
                  −{nextElim}
                  {eliminationWord(nextElim)}
                </span>
              {/if}
            </span>
          {/if}
        </Button>

        {#if !winner}
          <Button
            class="rounded-full px-4 py-5 text-sm font-bold shadow-lg disabled:opacity-50 sm:px-6 sm:text-base"
            variant="secondary"
            onclick={handleShield}
            disabled={isFiring || alive === 0 || shielded >= alive || nextElim === 0}
            title="Щит на {nextElim} {eliminationWord(nextElim)} — спасёт от 1 удара"
          >
            <span class="inline-flex items-center gap-1.5">
              <span>🛡️</span>
              <span class="hidden sm:inline">Дать щиты</span>
              <span class="sm:hidden">Дать щиты</span>
              {#if nextElim > 0 && alive > 0}
                {@const toShield = Math.min(nextElim, Math.max(0, alive - shielded))}
                {#if toShield > 0}
                  <span
                    class="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs leading-none font-black text-sky-200"
                    >+{toShield}</span
                  >
                {/if}
              {/if}
            </span>
          </Button>
        {/if}
      </div>
    </div>

    <!-- subtle top info: player count -->
    <div
      class="pointer-events-none absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2"
    >
      <div
        class="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs tracking-widest text-white/70 uppercase backdrop-blur"
      >
        Живы: {alive || players.length || '…'} / {players.length || '…'}
      </div>
      {#if pendingChatPlayers.length > 0}
        <div
          class="rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-xs tracking-widest text-amber-200 uppercase backdrop-blur"
        >
          В очереди: {pendingChatPlayers.length}
        </div>
      {/if}
      {#if winner}
        <div
          class="rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-xs font-bold tracking-widest text-amber-200 uppercase backdrop-blur"
        >
          Победитель: {winner}
        </div>
      {/if}
    </div>

    <!-- Top bar: connections + chat hint -->
    <div class="pointer-events-none absolute top-3 left-3 flex items-center gap-2">
      <div class="pointer-events-auto">
        <ConnectionDialog />
      </div>
      {#if gameStarted}
        <div
          class="hidden items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-200 backdrop-blur md:flex"
        >
          Набор закрыт — игра началась
        </div>
      {:else}
        <div
          class="hidden items-center gap-1 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/60 backdrop-blur md:flex"
        >
          Чат: <code class="rounded bg-white/10 px-1 font-bold text-white">+игра</code> — 1 раз на игрока
        </div>
      {/if}
    </div>

    <!-- Winner banner (Svelte DOM — regular <img> without CORS, server + badge icons) -->
    {#if winnerPlayer}
      <div
        class="pointer-events-none absolute top-[34%] left-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3"
      >
        <div
          class="flex flex-col items-center gap-1 rounded-2xl border-2 bg-[#0a0a1a] px-10 py-5 shadow-2xl"
          style="border-color: {winnerPlayer.color}; background-color: #0a0a1a;"
        >
          <div class="text-xs font-bold tracking-[0.2em] text-slate-400">ПОБЕДИТЕЛЬ</div>
          <div class="mt-1 flex items-center gap-3">
            {#if winnerPlayer.platform}
              <ServerIcon
                server={winnerPlayer.platform}
                status="connected"
                class="h-8 w-8 shrink-0"
                disableTooltip
              />
            {/if}
            <span
              class="text-3xl leading-none font-black tracking-tight text-white uppercase"
              style="-webkit-text-stroke: 1px {winnerPlayer.color}; text-shadow: 0 2px 8px rgba(0,0,0,0.6);"
              >{winnerPlayer.name.toUpperCase()}</span
            >
            {#if winnerBadgeInfo}
              {#if winnerBadgeInfo.url === '__kick_mod__'}
                <KickModeratorIcon class="h-8 w-8 shrink-0 object-contain" />
              {:else}
                <img
                  src={winnerBadgeInfo.url}
                  alt={winnerBadgeInfo.title}
                  class="h-8 w-8 shrink-0 rounded object-contain"
                />
              {/if}
            {:else}
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold text-white"
              >
                {winnerPlayer.name[0].toUpperCase()}
              </div>
            {/if}
          </div>
        </div>

        <button
          class="pointer-events-auto rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-xs font-bold tracking-widest text-white/80 uppercase backdrop-blur hover:bg-white/10"
          onclick={() => (winnerChatOpen = !winnerChatOpen)}
        >
          {winnerChatOpen ? 'Скрыть чат' : 'Показать чат'}
        </button>

        {#if winnerChatOpen}
          <div
            class="pointer-events-auto w-[min(90vw,420px)] rounded-xl border border-border/80 bg-card/90 p-3 shadow-2xl backdrop-blur"
          >
            <div
              class="flex max-h-40 flex-col gap-1.5 overflow-y-auto text-left text-sm"
              bind:this={winnerChatContainer}
            >
              {#each winnerMessages as msg (msg.id)}
                <div class="leading-tight">
                  <span class="text-xs text-white/50">
                    {new Date(msg.timestampMs).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </span>
                  <span class="text-white/70">:</span>
                  <span class="ml-1 text-white">{msg.text}</span>
                </div>
              {:else}
                <div class="text-sm text-muted-foreground">Нет сообщений</div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Secondary actions -->
    <button
      onclick={reshuffle}
      class="pointer-events-auto absolute top-3 right-4 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/60 backdrop-blur hover:bg-white/10"
    >
      Reshuffle
    </button>
  </div>
</div>

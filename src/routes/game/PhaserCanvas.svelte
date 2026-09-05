<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { GameStats, HexPlayer } from '$lib/phaser/MainScene'
  import { MainScene } from '$lib/phaser/MainScene'
  import Phaser from 'phaser'

  let {
    onStats,
    onGameOver,
  }: { onStats?: (s: GameStats) => void; onGameOver?: (score: number) => void } = $props()

  let container: HTMLDivElement | null = $state(null)
  let game: Phaser.Game | null = null
  let scene: MainScene | null = null
  let attachInterval: ReturnType<typeof setInterval> | null = null

  export function getScene() {
    return scene
  }
  export function restart() {
    scene?.restartGame()
  }
  export function fire() {
    scene?.fire()
  }
  export function getNextEliminationCount() {
    return scene?.getNextEliminationCount() ?? 0
  }
  export function getShieldedCount() {
    return scene?.getShieldedCount() ?? 0
  }
  export function getDeadCount() {
    return scene?.getDeadCount() ?? 0
  }
  export function resurrect() {
    return scene?.resurrect() ?? 0
  }
  export function shield() {
    return scene?.shield() ?? 0
  }
  // keep legacy nudge for chat integration compat
  export function nudge(dir: 'left' | 'right') {
    scene?.nudge(dir)
  }
  export function setPlayers(players: HexPlayer[]) {
    scene?.setPlayers(players)
  }
  export function addPlayers(players: HexPlayer[]) {
    scene?.addPlayers(players)
  }
  export function addPlayer(player: HexPlayer) {
    scene?.addPlayers([player])
  }
  export function clearPlayers() {
    scene?.setPlayers([])
  }
  export function newGame() {
    scene?.newGame()
  }
  export function reshuffle() {
    scene?.reshuffle()
  }
  export function generateDemo(count?: number) {
    scene?.generateDemo(count)
  }

  $effect(() => {
    if (scene) {
      scene.setCallbacks({ onStatsUpdate: onStats, onGameOver: onGameOver })
    }
  })

  onMount(() => {
    ;(async () => {
      if (!container) return

      if (game) {
        game.destroy(true)
        game = null
      }

      const { clientWidth: w, clientHeight: h } = container

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: container,
        width: w || 800,
        height: h || 600,
        backgroundColor: '#0a0a1a',
        physics: {
          default: 'arcade',
          arcade: { gravity: { x: 0, y: 0 }, debug: false },
        },
        scene: [MainScene],
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        render: {
          antialias: true,
          powerPreference: 'high-performance',
        },
      })

      const attach = () => {
        const s = game?.scene.getScene('MainScene') as MainScene | undefined
        if (s && (s.sys as unknown as { isActive?: () => boolean })?.isActive?.()) {
          scene = s
          s.setCallbacks({ onStatsUpdate: onStats, onGameOver: onGameOver })
          s.events.on('stats', (stats: GameStats) => onStats?.(stats))
          s.events.on('gameover', (score: number) => onGameOver?.(score))
          return true
        }
        return false
      }

      attachInterval = setInterval(() => {
        if (attach() && attachInterval) {
          clearInterval(attachInterval)
          attachInterval = null
        }
      }, 50)
      setTimeout(attach, 400)

      // handle parent resize via ResizeObserver to inform Phaser Scale Manager
      const ro = new ResizeObserver(() => {
        if (!container || !game) return
        game.scale.resize(container.clientWidth, container.clientHeight)
      })
      ro.observe(container)
      // store for cleanup via closure
      ;(container as unknown as { __ro?: ResizeObserver }).__ro = ro
    })()
  })

  onDestroy(() => {
    if (attachInterval) clearInterval(attachInterval)
    const ro = (container as unknown as { __ro?: ResizeObserver })?.__ro
    if (ro && container) ro.disconnect()
    if (game) {
      game.destroy(true)
      game = null
      scene = null
    }
  })
</script>

<div
  bind:this={container}
  class="phaser-container relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-[#0a0a1a]"
></div>

<style>
  .phaser-container :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
</style>

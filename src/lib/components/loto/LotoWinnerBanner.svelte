<script lang="ts">
  import type { ChatUser } from '$lib/types'
  import { scale, fly } from 'svelte/transition'
  import PlayerName from './PlayerName.svelte'

  type Props = {
    user?: ChatUser
    name: string
  }

  let { user, name }: Props = $props()

  const confettiColors = [
    '#FFD700',
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
  ]

  let confettiPieces = $state(
    Array.from({ length: 50 }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
    })),
  )

  $effect(() => {
    const interval = setInterval(() => {
      confettiPieces = Array.from({ length: 50 }, (_, i) => ({
        id: `${Date.now()}-${i}`,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
      }))
    }, 5000)

    return () => clearInterval(interval)
  })
</script>

<div class="relative flex flex-col items-center gap-6">
  <div class="absolute inset-0">
    {#each confettiPieces as piece (piece.id)}
      <div
        class="confetti absolute"
        style="
          background-color: {piece.color};
          left: {piece.left}%;
          top: {piece.top}%;
          width: {piece.size}px;
          height: {piece.size}px;
          transform: rotate({piece.rotation}deg);
        "
      ></div>
    {/each}
  </div>

  <div
    class="relative z-10 flex flex-col items-center justify-center rounded-3xl border-2 border-yellow-500 bg-yellow-900/60 p-8 shadow-2xl ring-4 ring-yellow-500/50"
    in:fly={{ y: -50, duration: 800, easing: (t) => t * (2 - t) }}
  >
    <div
      class="flex flex-col items-center"
      in:scale={{ start: 0.5, duration: 800, easing: (t) => t * (2 - t) }}
    >
      <div class="mb-4 animate-bounce text-6xl" style="animation-duration: 1s;">🎉</div>
      <h1 class="mb-4 animate-pulse text-4xl font-black text-yellow-400">ПОБЕДИТЕЛЬ!</h1>
      <PlayerName {user} {name} class="text-2xl" />
    </div>
  </div>
</div>

<style>
  @keyframes confetti {
    0% {
      transform: translateY(0) rotate(0deg);
      opacity: 1;
    }
    60% {
      opacity: 0;
    }
    100% {
      transform: translateY(-200px) rotate(720deg);
      opacity: 0;
    }
  }

  :global(.confetti) {
    position: absolute;
    animation: confetti 5s ease-out forwards;
    border-radius: 2px;
  }
</style>

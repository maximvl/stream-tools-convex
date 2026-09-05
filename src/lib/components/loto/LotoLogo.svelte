<script lang="ts">
  import { cn } from '$lib/utils'
  import { onMount, onDestroy } from 'svelte'

  type Props = {
    class?: string
  }

  let { class: className }: Props = $props()
  let isAnimating = $state(false)
  let intervalId: number | undefined

  const startAnimation = () => {
    isAnimating = true
    setTimeout(() => {
      isAnimating = false
    }, 2500)
  }

  onMount(() => {
    startAnimation()
    intervalId = window.setInterval(startAnimation, 9000)
  })

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId)
    }
  })
</script>

<div class={cn('relative flex items-center justify-center gap-4', className)}>
  <div class="relative">
    <div
      class="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 opacity-50 blur-xl"
    ></div>
    <div
      class="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-4xl font-black text-white shadow-lg"
      class:animate-fun-bounce={isAnimating}
    >
      🎱
    </div>
  </div>
  <div class="flex flex-col">
    <h1
      class="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-6xl font-black tracking-tighter text-transparent uppercase italic"
      class:animate-vibrant-shimmer={isAnimating}
    >
      Лото&nbsp;
    </h1>
    <div class="flex gap-2">
      <div
        class="h-2 w-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
        class:animate-dot-bounce={isAnimating}
        style="animation-delay: 0s;"
      ></div>
      <div
        class="h-2 w-4 rounded-full bg-gradient-to-r from-pink-500 to-orange-500"
        class:animate-dot-bounce={isAnimating}
        style="animation-delay: 0.1s;"
      ></div>
      <div
        class="h-2 w-4 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500"
        class:animate-dot-bounce={isAnimating}
        style="animation-delay: 0.2s;"
      ></div>
    </div>
  </div>
</div>

<style>
  @keyframes fun-bounce {
    0%,
    100% {
      transform: scale(1) rotate(0deg);
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    }
    25% {
      transform: scale(1.1) rotate(-5deg);
      box-shadow: 0 25px 30px -5px rgb(0 0 0 / 0.3);
    }
    50% {
      transform: scale(1.05) rotate(5deg);
      box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.25);
    }
    75% {
      transform: scale(1.1) rotate(-3deg);
      box-shadow: 0 25px 30px -5px rgb(0 0 0 / 0.3);
    }
  }

  @keyframes vibrant-shimmer {
    0% {
      background-position: -200% center;
      filter: brightness(1);
    }
    50% {
      filter: brightness(1.2);
    }
    100% {
      background-position: 200% center;
      filter: brightness(1);
    }
  }

  @keyframes dot-bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }

  .animate-fun-bounce {
    animation: fun-bounce 2.5s ease-in-out;
  }

  .animate-vibrant-shimmer {
    background-size: 200% auto;
    animation: vibrant-shimmer 2s ease-in-out;
  }

  .animate-dot-bounce {
    animation: dot-bounce 0.6s ease-in-out;
  }
</style>

<script lang="ts">
  import { FIREWORKS_IMG } from '$lib/constants'
  import type { Item } from '$lib/turnir/types'

  type Props = {
    winner: Item
  }

  let { winner }: Props = $props()

  let show = $state(false)

  $effect(() => {
    const id = setTimeout(() => (show = true), 500)
    return () => clearTimeout(id)
  })
</script>

<div class="flex flex-col items-center text-center">
  <h1 class="mt-4 text-3xl font-extrabold">Победитель</h1>
  <div class="mt-2 w-full bg-black px-6">
    <div
      class="raising flex w-full justify-center bg-black"
      style:visibility={show ? 'visible' : 'hidden'}
    >
      <div class="neon bg-black text-center">
        <span class="neon-text" data-text={winner.title.toLocaleUpperCase()}>
          {winner.title.toLocaleUpperCase()}
        </span>
        <span class="neon-gradient"></span>
        <span class="neon-spotlight"></span>
      </div>
    </div>
  </div>
  <img src={FIREWORKS_IMG} alt="" class="relative z-10 w-full" />
</div>

<style>
  /* Ported from the original turnir app (neon + raising animations). */
  .neon {
    position: relative;
    overflow: hidden;
    filter: brightness(200%);
  }

  .neon-text {
    color: white;
    font-size: 50px;
    font-weight: bold;
    font-family: sans-serif;
    text-transform: uppercase;
  }

  .neon-text::before {
    content: attr(data-text);
    position: absolute;
    color: white;
    filter: blur(0.02em);
    mix-blend-mode: difference;
    left: 0;
  }

  .neon-gradient {
    position: absolute;
    background: linear-gradient(45deg, red, gold, lightgreen, gold, red);
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    mix-blend-mode: multiply;
  }

  .neon-spotlight {
    position: absolute;
    top: -100%;
    left: -100%;
    right: 0;
    bottom: 0;
    background:
      radial-gradient(circle, white, transparent 25%) center / 25% 25%,
      radial-gradient(circle, white, black 25%) center / 12.5% 12.5%;
    animation: neon-light 5s linear infinite;
    mix-blend-mode: color-dodge;
  }

  @keyframes neon-light {
    to {
      transform: translate(50%, 50%);
    }
  }

  .raising {
    position: relative;
    animation: raising-animation 8s linear;
  }

  @keyframes raising-animation {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0%);
    }
  }
</style>

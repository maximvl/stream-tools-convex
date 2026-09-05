<script lang="ts">
  import { getLotoStore } from '$lib/stores/lotoStore.svelte'
  import { onMount } from 'svelte'

  const lotoStore = getLotoStore()

  const COLS = 10
  const total = lotoStore.superGameValues.length
  const ROWS = $derived(Math.ceil(total / COLS))

  const WAVE_DURATION = 3000 // ms for full diagonal sweep
  const WAVE_LENGTH = $derived(ROWS + COLS)
  const STEP_MS = $derived(WAVE_DURATION / WAVE_LENGTH)

  // --- chaotic highlight layer ---
  let highlighted = $state<Record<number, number>>({})

  // --- diagonal wave layer ---
  let waveStep = $state(0)

  function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  function updateHighlights() {
    const total = lotoStore.superGameValues.length

    const next: Record<number, number> = {}

    const count = randomInt(Math.floor(total * 0.1), Math.floor(total * 0.3))

    for (let i = 0; i < count; i++) {
      const idx = randomInt(0, total - 1)
      next[idx] = randomInt(0, 2)
    }

    highlighted = next
  }

  function getWaveIntensity(idx: number) {
    const row = Math.floor(idx / COLS)
    const col = idx % COLS

    const wavePos = row + col
    const diff = wavePos - waveStep

    if (diff < 0 || diff > 4) return 0

    // fade off trail
    return 1 - diff / 4
  }

  onMount(() => {
    updateHighlights()

    const chaos = setInterval(() => {
      updateHighlights()
    }, 900)

    const wave = setInterval(() => {
      waveStep = (waveStep + 1) % WAVE_LENGTH
    }, STEP_MS)

    return () => {
      clearInterval(chaos)
      clearInterval(wave)
    }
  })
</script>

<div class="grid grid-cols-10 gap-2 text-center" style="width: fit-content;">
  {#each lotoStore.superGameValues as _, idx (idx)}
    {@const chaos = highlighted[idx]}
    {@const wave = getWaveIntensity(idx)}

    <div
      class="relative flex h-12 w-12 items-center justify-center overflow-hidden border border-white/10 transition-all duration-500"
      style="
        transform:
          scale({chaos ? 1.12 : 1})
          scale({wave > 0 ? 1 + wave * 0.08 : 1});

        background:
          {wave > 0
        ? `rgba(120,200,255,${0.08 + wave * 0.25})`
        : chaos
          ? `rgba(255,215,0,0.12)`
          : 'rgba(255,255,255,0.03)'};

        box-shadow:
          {wave > 0
        ? `0 0 ${10 + wave * 30}px rgba(120,200,255,${0.4 + wave * 0.3})`
        : chaos
          ? '0 0 18px rgba(255,215,0,0.35)'
          : 'none'};
      "
    >
      <!-- diagonal wave glow overlay -->
      {#if wave > 0}
        <div
          class="pointer-events-none absolute inset-0"
          style="
            background: radial-gradient(
              circle,
              rgba(180,220,255,{wave * 0.35}),
              transparent 70%
            );
            opacity: {wave};
          "
        ></div>
      {/if}

      <!-- chaos pulse -->
      {#if chaos}
        <div
          class="absolute inset-0 animate-pulse rounded-full"
          style="
            background: rgba(255,215,0,0.12);
          "
        ></div>
      {/if}

      <span
        class="relative z-10 font-bold transition-all"
        style="
          text-shadow:
            {wave > 0
          ? '0 0 10px rgba(180,220,255,0.8)'
          : chaos
            ? '0 0 10px rgba(255,255,255,0.7)'
            : 'none'};
        "
      >
        {(idx + 1).toString().padStart(2, '0')}
      </span>
    </div>
  {/each}
</div>

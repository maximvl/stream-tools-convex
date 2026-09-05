<!-- PatternBackground.svelte -->
<script lang="ts">
  interface Props {
    images: string[]
    tileSize?: number
    gap?: number
    opacity?: number
    hoverOpacity?: number
    overlay?: string
    fixed?: boolean
    maxRotation?: number
    maxOffset?: number
    scaleVariation?: number
    borderRadiusVariation?: boolean
    polaroidChance?: number
    tapeChance?: number
    shadowIntensity?: number
    staggered?: boolean
    backgroundColor?: string
  }

  interface TileData {
    src: string
    key: string
    x: number
    y: number
    rotation: number
    scale: number
    borderRadius: string
    zIndex: number
    polaroid: boolean
    tape: boolean
    shadow: string
    width: number
    height: number
  }

  let {
    images,
    tileSize = 140,
    gap = 12,
    opacity = 0.6,
    hoverOpacity = 1,
    overlay = 'rgba(10, 10, 30, 0.5)',
    fixed = true,
    maxRotation = 15,
    maxOffset = 20,
    scaleVariation = 0.2,
    borderRadiusVariation = true,
    polaroidChance = 0.1,
    tapeChance = 0.06,
    shadowIntensity = 0.2,
    staggered = true,
    backgroundColor = '#0a0a1a',
  }: Props = $props()

  let container = $state<HTMLDivElement | null>(null)
  let tiles = $state<TileData[]>([])

  let resizeReady = $state(true)
  let preloadReady = $state(false)
  const imagesReady = $derived(resizeReady && preloadReady)

  let imageAspects = $state<Record<string, number>>({})

  const random = (min: number, max: number) => Math.random() * (max - min) + min

  function randomElement<T>(array: T[], exclude: T[]): T {
    let index: number
    do {
      index = Math.floor(random(0, array.length))
    } while (exclude.includes(array[index]))
    return array[index]
  }

  async function preloadImages() {
    const unique = [...new Set(images)]
    await Promise.all(
      unique.map((src) => {
        if (imageAspects[src] !== undefined) return Promise.resolve()
        return new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => {
            imageAspects[src] = img.naturalWidth / img.naturalHeight
            resolve()
          }
          img.onerror = () => {
            imageAspects[src] = 1
            resolve()
          }
          img.src = src
        })
      }),
    )
  }

  function generateTiles() {
    if (!container || images.length === 0) {
      tiles = []
      return
    }

    const buffer = tileSize * 2
    const width = container.clientWidth + buffer * 2
    const height = container.clientHeight + buffer * 2

    const cols = Math.ceil(width / (tileSize + gap))
    const rows = Math.ceil(height / (tileSize + gap))
    const total = cols * rows

    const next: TileData[] = []

    for (let i = 0; i < total; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)

      const baseX = col * (tileSize + gap) - buffer
      const baseY = row * (tileSize + gap) - buffer
      const staggerX = staggered && row % 2 === 1 ? tileSize / 2 : 0

      const src = randomElement(images, i > 0 ? [next[i - 1].src] : [])
      const aspect = imageAspects[src] ?? 1

      const polaroid = Math.random() < polaroidChance
      const tape = !polaroid && Math.random() < tapeChance

      let width = tileSize
      let imgHeight = tileSize / aspect

      if (polaroid) {
        const availableWidth = tileSize - 16
        imgHeight = availableWidth / aspect
      }

      const height = polaroid ? imgHeight + 40 : imgHeight

      next.push({
        src,
        key: `${row}-${col}-${src}-${width.toFixed(0)}-${height.toFixed(0)}`,
        x: baseX + random(-maxOffset, maxOffset) + staggerX,
        y: baseY + random(-maxOffset, maxOffset),
        rotation: random(-maxRotation, maxRotation),
        scale: random(1 - scaleVariation, 1 + scaleVariation),
        borderRadius: borderRadiusVariation
          ? `${Math.floor(random(2, 40))}px ${Math.floor(random(2, 40))}px ${Math.floor(random(2, 40))}px ${Math.floor(random(2, 40))}px`
          : '16px',
        zIndex: Math.floor(random(1, 50)),
        polaroid,
        tape,
        shadow: `${random(-6, 6)}px ${random(4, 12)}px ${random(8, 20)}px rgba(0,0,0,${shadowIntensity})`,
        width,
        height,
      })
    }

    tiles = next
  }

  preloadImages().then(() => {
    generateTiles()
    // double RAF ensures the browser has painted the empty state before
    // flipping ready, giving the transition something to interpolate from
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        preloadReady = true
      })
    })
  })

  $effect(() => {
    let ro: ResizeObserver | null = null
    const handleResize = () => {
      if (!preloadReady) return
      resizeReady = false
      requestAnimationFrame(() => {
        generateTiles()
        requestAnimationFrame(() => {
          resizeReady = true
        })
      })
    }

    if ('ResizeObserver' in window && container) {
      ro = new ResizeObserver(handleResize)
      ro.observe(container)
    } else {
      window.addEventListener('resize', handleResize)
    }

    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  })
</script>

<div
  bind:this={container}
  class="pattern-bg"
  class:fixed
  class:ready={imagesReady}
  style:background-color={backgroundColor}
  style="--hover-opacity: {hoverOpacity};"
>
  {#each tiles as tile (tile.key)}
    <div
      class="tile"
      class:polaroid={tile.polaroid}
      class:tape={tile.tape}
      style:left="{tile.x}px"
      style:top="{tile.y}px"
      style:width="{tile.width}px"
      style:height="{tile.height}px"
      style:transform="rotate({tile.rotation}deg) scale({tile.scale})"
      style:border-radius={tile.borderRadius}
      style:z-index={tile.zIndex}
      style:box-shadow={tile.shadow}
    >
      <img src={tile.src} alt="" loading="eager" decoding="async" draggable="false" style:opacity />
      {#if tile.tape}
        <div class="tape-strip"></div>
      {/if}
    </div>
  {/each}

  <div class="overlay" style:background={overlay}></div>
</div>

<style>
  .pattern-bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    user-select: none;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.6s ease;
  }

  .pattern-bg.ready {
    opacity: 1;
  }

  .pattern-bg.fixed {
    position: fixed;
    inset: 0;
    z-index: -1;
  }

  .tile {
    position: absolute;
    overflow: visible;
    transition:
      transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.3s ease,
      z-index 0s,
      opacity 0.6s ease;
    pointer-events: auto;
    will-change: transform;
    background: rgba(255, 255, 255, 0.03);
    opacity: 0;
  }

  .ready .tile {
    opacity: 1;
  }

  .tile:hover {
    transform: rotate(0deg) scale(1.2) !important;
    z-index: 999 !important;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.35) !important;
  }

  .tile img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: opacity 0.3s ease;
  }

  .tile:hover img {
    opacity: var(--hover-opacity) !important;
  }

  .tile.polaroid {
    padding: 8px 8px 32px 8px;
    background: #fafafa;
  }

  .tile.polaroid img {
    border-radius: 2px;
    object-fit: contain;
  }

  .tape-strip {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%) rotate(-2deg);
    width: 40%;
    height: 24px;
    background: rgba(255, 255, 255, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(2px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    pointer-events: none;
  }

  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1000;
  }
</style>

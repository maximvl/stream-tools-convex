<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import type { Item } from '$lib/turnir/types'
  import ItemTitle from './ItemTitle.svelte'

  type Props = {
    items: Item[]
    onItemWinning: (id: string) => void
    confirmLabel?: string
    confirmVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  }

  let {
    items,
    onItemWinning,
    confirmLabel = 'Удалить',
    confirmVariant = 'destructive',
  }: Props = $props()

  type WheelState = 'start' | 'acceleration' | 'constant' | 'deceleration' | 'stop'

  let canvas: HTMLCanvasElement | null = $state(null)
  let isFinished = $state(false)
  let hasBacktrack = $state(Math.random() > 0.5)
  let initialAngle = $state(Math.floor(Math.random() * 360))

  let rotation = 0
  let speed = 0
  let wheelState = $state<WheelState>('start')
  let lastTime: number | null = null
  let rafId: number | null = null

  const SIZE = 400
  const DIAMETER = SIZE
  const RADIUS = DIAMETER / 2 + 2
  const CENTER = DIAMETER / 2
  const CENTER_RADIUS = 30

  const COLORS = [
    '#3f51b5',
    '#009688',
    '#e91e63',
    '#ef6c00',
    '#43a047',
    '#2196f3',
    '#ba68c8',
    '#607d8b',
    '#795548',
    '#6a1b9a',
  ]

  const START_SPEED = 0.00009
  const SLOWEST_SPEED = 0.0006
  const FASTEST_SPEED = 0.2
  const ACCELERATION = 0.0005
  const BACKTRACK_SPEED = -0.001

  let decelerationSteps: Array<[number, number]> = $derived.by(() => {
    const steps: Array<[number, number]> = []
    let current = FASTEST_SPEED
    while (current > SLOWEST_SPEED) {
      current = (current / 100) * 80
      steps.push([current, 500])
    }
    return steps
  })
  let backtrackTime = $derived(2500 + 700 * Math.random())

  let amountOfItems = $derived(items.length)
  let pieceAngle = $derived((2 * Math.PI) / Math.max(1, amountOfItems))
  let angleHalf = $derived(pieceAngle / 2)

  function getSelectedItemId(rot: number): number {
    const startingAngle = angleHalf + ((90 + initialAngle) * Math.PI) / 180
    const initialIndex = Math.round((startingAngle + rot) / pieceAngle) - 1
    return amountOfItems - 1 - (initialIndex % amountOfItems)
  }

  let currentItemIndex = $state(0)
  let currentItem = $derived(items[currentItemIndex])

  function drawWheel() {
    const context = canvas?.getContext('2d')
    if (!context || amountOfItems === 0) return
    const selectedIndex = getSelectedItemId(rotation)

    context.clearRect(0, 0, SIZE, SIZE)
    context.save()
    context.translate(CENTER, CENTER)
    context.rotate(rotation + (initialAngle * Math.PI) / 180)

    const piece = new Path2D()
    piece.moveTo(0, 0)
    piece.arc(0, 0, RADIUS, 0, pieceAngle)
    piece.lineTo(0, 0)

    const separator = new Path2D()
    separator.moveTo(0, 0)
    separator.lineTo(RADIUS * Math.cos(0), RADIUS * Math.sin(0))

    context.font = '15px Arial'
    const textOffsetFromCenter = 45
    for (let i = 0; i < amountOfItems; i++) {
      const color = COLORS[i % COLORS.length]
      context.fillStyle = wheelState === 'stop' && i !== selectedIndex ? '#36454F' : color
      context.fill(piece)
      context.strokeStyle = 'white'
      context.lineWidth = 2
      context.stroke(separator)

      context.save()
      context.rotate(angleHalf)
      let text = items[i]?.title ?? ''
      const textWidth = context.measureText(text).width
      if (textWidth + textOffsetFromCenter > RADIUS) {
        text = text.slice(0, 18) + '...'
      }
      context.fillStyle = 'white'
      context.fillText(text, textOffsetFromCenter, 5)
      context.restore()

      context.rotate(pieceAngle)
    }
    context.strokeStyle = 'white'
    context.lineWidth = 2
    context.stroke(separator)
    context.restore()

    // arrow
    const arrow = new Path2D()
    arrow.moveTo(CENTER, CENTER - RADIUS + 30)
    arrow.lineTo(CENTER - 30, CENTER - RADIUS)
    arrow.lineTo(CENTER - 18, CENTER - RADIUS + 2)
    arrow.lineTo(CENTER, CENTER - RADIUS + 20)
    arrow.lineTo(CENTER + 18, CENTER - RADIUS + 2)
    arrow.lineTo(CENTER + 30, CENTER - RADIUS)
    arrow.lineTo(CENTER, CENTER - RADIUS + 30)
    context.fillStyle = 'white'
    context.strokeStyle = 'black'
    context.lineWidth = 2
    context.fill(arrow)
    context.stroke(arrow)
  }

  function animate(time: number) {
    if (lastTime !== null) {
      const delta = time - lastTime
      if (delta > 5) {
        switch (wheelState) {
          case 'acceleration':
            speed += ACCELERATION
            if (speed >= FASTEST_SPEED) {
              wheelState = 'constant'
              const randomTime = Math.random() * 1500 + Math.random() * 1000 + 1500
              setTimeout(() => {
                if (wheelState === 'constant') wheelState = 'deceleration'
              }, randomTime)
            }
            break
          case 'deceleration': {
            let timer = 0
            for (const step of decelerationSteps) {
              if (speed > step[0]) {
                speed = step[0]
                timer = step[1]
                break
              }
            }
            if (speed <= SLOWEST_SPEED) {
              if (hasBacktrack) {
                speed = BACKTRACK_SPEED
                wheelState = 'constant'
                setTimeout(() => {
                  isFinished = true
                  speed = 0
                  wheelState = 'stop'
                }, backtrackTime)
              } else {
                isFinished = true
                speed = 0
                wheelState = 'stop'
              }
            } else {
              setTimeout(() => {
                if (wheelState === 'constant') wheelState = 'deceleration'
              }, timer)
              wheelState = 'constant'
            }
            break
          }
          default:
            break
        }
        rotation = rotation + speed
        if (rotation > 2 * Math.PI) rotation = 0
        drawWheel()
        lastTime = time
        const nextIndex = getSelectedItemId(rotation)
        if (nextIndex !== currentItemIndex) currentItemIndex = nextIndex
      }
    } else {
      lastTime = time
    }
    rafId = requestAnimationFrame(animate)
  }

  function resetWheel() {
    rotation = 0
    speed = 0
    wheelState = 'start'
    lastTime = null
    isFinished = false
    hasBacktrack = Math.random() > 0.5
    initialAngle = Math.floor(Math.random() * 360)
    currentItemIndex = getSelectedItemId(rotation)
    drawWheel()
  }

  function startSpinning() {
    if (wheelState === 'start') {
      wheelState = 'acceleration'
      speed = START_SPEED
    }
  }

  function confirmWinner() {
    if (!currentItem) return
    isFinished = false
    rotation = 0
    speed = 0
    wheelState = 'start'
    onItemWinning(currentItem.id)
  }

  // (re)start RAF loop whenever the item count changes; cleanup on destroy.
  $effect(() => {
    const count = items.length
    if (count === 0) return
    resetWheel()
    rafId = requestAnimationFrame(animate)
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = null
    }
  })
</script>

<div class="flex flex-col items-center justify-center">
  {#if currentItem}
    <h2 class="m-0 flex items-center justify-center text-xl font-bold">
      <ItemTitle item={currentItem} />
    </h2>
  {/if}
  {#if isFinished}
    <Button variant={confirmVariant} class="m-2" onclick={confirmWinner}>{confirmLabel}</Button>
  {/if}
  <div class="mt-2 flex justify-center">
    <div
      class="relative m-0 flex items-center justify-center rounded-full border-4 border-white p-0"
      style:width={`${SIZE + 8}px`}
      style:height={`${SIZE + 8}px`}
      style:z-index={5}
    >
      <canvas
        bind:this={canvas}
        width={SIZE}
        height={SIZE}
        onclick={startSpinning}
        class="absolute top-0 left-0"
        style:z-index={1}
        style:opacity={wheelState === 'start' ? 0.5 : 1}
      ></canvas>
      <div
        role="button"
        tabindex="0"
        aria-label="Крутить колесо"
        onclick={startSpinning}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') startSpinning()
        }}
        class="absolute rounded-full border-6 border-white"
        style:top="-6px"
        style:left="-6px"
        style:width={`${SIZE + 12}px`}
        style:height={`${SIZE + 12}px`}
        style:z-index={2}
      ></div>
      {#if wheelState === 'start'}
        <Button onclick={startSpinning} class="z-10">Запуск</Button>
      {/if}
    </div>
  </div>
</div>

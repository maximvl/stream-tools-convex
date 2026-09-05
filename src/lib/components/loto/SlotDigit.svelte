<script lang="ts">
  import { onMount } from 'svelte'
  import { animate, remove } from 'animejs'
  import { cn } from '$lib/utils'

  type Props = {
    target: string // Single digit "0"-"9"
    direction?: 'up' | 'down'
    duration?: number
    animationKey: string | null // Change this to trigger animation
    class?: string
  }

  let {
    target,
    direction = 'up',
    duration = 2000,
    animationKey,
    class: className,
  }: Props = $props()

  let strip: HTMLElement | undefined = $state()
  let container: HTMLElement | undefined = $state()

  // We'll use 20 repeats for a very long, safe roll range
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  const repeatedDigits = Array(20).fill(digits).flat()

  const displayTarget = $derived(target)

  function setInitialPosition() {
    if (!strip || !container) return
    const h = 64 // Use fixed height to match h-16 (16 * 4px)
    const targetIdx = displayTarget ? digits.indexOf(displayTarget) : 0
    const finalY = -(targetIdx * h)

    remove(strip)
    animate(strip, {
      translateY: finalY,
      duration: 0,
    })
  }

  function runAnimation() {
    if (!strip || !container) return

    const h = 64 // Match h-16
    const targetIdx = displayTarget ? digits.indexOf(displayTarget) : 0
    if (targetIdx === -1) return

    // End on the 10th repeat (middle of the 20-repeat strip)
    const repeatOffset = 10
    const finalY = -((repeatOffset * 10 + targetIdx) * h)

    // Roll 5 cycles (50 digits)
    const rollCycles = 5
    const rollDistance = rollCycles * 10 * h
    const startY = direction === 'up' ? finalY - rollDistance : finalY + rollDistance

    remove(strip)
    animate(strip, {
      translateY: [startY, finalY],
      duration: duration,
      ease: 'outQuart',
    })
  }

  onMount(() => {
    setInitialPosition()
  })

  $effect(() => {
    if (animationKey) {
      runAnimation()
    }
  })
</script>

<div
  bind:this={container}
  class={cn(
    'relative h-16 w-10 overflow-hidden rounded-lg border border-primary/20 bg-background shadow-inner',
    className,
  )}
>
  <div bind:this={strip} class="absolute top-0 left-0 flex w-full flex-col">
    {#each repeatedDigits as d, i (i)}
      <div class="flex h-16 w-full shrink-0 items-center justify-center text-4xl font-black">
        {d}
      </div>
    {/each}
  </div>
</div>

<style>
  /* No additional overlay to keep digits clear and high-contrast */
</style>

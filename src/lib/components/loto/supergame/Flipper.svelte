<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { cn } from '$lib/utils'
  import type { Snippet } from 'svelte'

  let flipped = $state(false)

  type Props = {
    class?: string
    hidden?: Snippet
    revealed?: Snippet
    oneShot?: boolean
    onFlip?: () => void
    disabled?: boolean
  }

  let { class: className = '', hidden, revealed, oneShot = false, onFlip, disabled = false }: Props = $props()

  function toggle() {
    if (oneShot && flipped) {
      return
    }
    flipped = !flipped
    setTimeout(() => {
      onFlip?.()
    }, 800)
  }
</script>

<Button
  class={cn('flipper bg-transparent hover:bg-transparent', flipped ? 'flipped' : '', className, disabled ? 'cursor-default!' : '')}
  onclick={toggle}
  disabled={disabled}
>
  <div class="inner">
    <div class="face front">
      {@render hidden?.()}
    </div>

    <div class="face back">
      {@render revealed?.()}
    </div>
  </div>
</Button>

<style>
  :global(.flipper) {
    perspective: 1000px;

    padding: 0;
    margin: 0;
    pointer-events: none;
  }

  :global(.inner) {
    display: grid;

    transform-style: preserve-3d;
    transition: transform 1s cubic-bezier(0.4, 0.2, 0.2, 1);
  }

  :global(.flipped .inner) {
    transform: rotateY(180deg);
  }

  :global(.face) {
    grid-area: 1 / 1;

    display: flex;
    align-items: center;
    justify-content: center;

    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    pointer-events: auto;
  }

  :global(.front) {
    transform: rotateY(0deg);
  }

  :global(.back) {
    transform: rotateY(180deg);
  }

  /* :global(.flipped .back) {
    transform: rotateY(180deg);
  }

  :global(.flipped .back > *) {
    transform: rotateY(-180deg);
  } */
</style>

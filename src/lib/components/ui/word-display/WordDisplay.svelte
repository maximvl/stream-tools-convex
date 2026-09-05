<script lang="ts">
  import * as Tooltip from '../tooltip'

  type Props = {
    word: string
    revealed?: boolean
  }

  let { word, revealed = false }: Props = $props()
  let revealedIndices = $state<Record<number, boolean>>({})

  $effect(() => {
    if (revealed) {
      word.split('').forEach((_, i) => (revealedIndices[i] = true))
    } else {
      revealedIndices = {}
    }
  })
</script>

<div class="flex flex-wrap gap-2">
  {#each word as char, i (i)}
    <Tooltip.Root delayDuration={0}>
      <Tooltip.Trigger>
        <div class="group h-12 w-12 perspective-[1000px]">
          <button
            class="relative h-full w-full transition-transform duration-400 ease-out transform-3d
            {revealedIndices[i]
              ? 'transform-[rotateY(180deg)]'
              : 'cursor-pointer hover:scale-105 active:scale-95'}"
            onclick={() => (revealedIndices[i] = true)}
          >
            <!-- Front -->
            <div
              class="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-white bg-blue-900 shadow-md backface-hidden"
            ></div>
            <!-- Back -->
            <div
              class="absolute inset-0 flex transform-[rotateY(180deg)] items-center justify-center rounded-lg border-2 border-white bg-blue-900 text-2xl font-bold text-white uppercase shadow-md backface-hidden"
            >
              {char}
            </div>
          </button>
        </div>
      </Tooltip.Trigger>
      {#if !revealedIndices[i]}
        <Tooltip.Content>Открыть букву</Tooltip.Content>
      {/if}
    </Tooltip.Root>
  {/each}
</div>

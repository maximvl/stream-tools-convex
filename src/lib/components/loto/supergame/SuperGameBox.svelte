<script lang="ts">
  import RewardItem from './RewardItem.svelte'
  import { getLotoStore } from '$lib/stores/lotoStore.svelte'
  import Flipper from './Flipper.svelte'
  import { cn } from '$lib/utils'
  import Animation4 from './Animation4.svelte'

  const lotoStore = getLotoStore()
  const revealAll = $derived(lotoStore.superGameState === 'finished')
</script>

<div class="bg-slate-800 p-4 rounded-xl">
{#if lotoStore.superGameState === 'not_started'}
  <Animation4 />
{:else}
  <div class="grid grid-cols-10 justify-center gap-2 text-center">
    {#each lotoStore.superGameValues as value, idx (idx)}
      {@const active = lotoStore.superGameGuesses.includes(idx + 1)}
      {#snippet hidden()}
        <div
          class={cn(
            'cell flex h-12 w-12 items-center justify-center', 
            active ? 'cell-highlight' : ''
          )}
        >
          <span class="cell-text">{(idx + 1).toString().padStart(2, '0')}</span>
        </div>
      {/snippet}
      {#snippet revealed()}
        <RewardItem
          class={cn('cell h-12 w-12 p-1', active ? 'cell-highlight' : '')}
          reward={value}
          vkRoles={lotoStore.allVkRoles}
          emptyPlaceholder={active ? '' : (idx + 1).toString().padStart(2, '0')}
        />
      {/snippet}
      <Flipper
        oneShot
        disabled={!active}
        class="h-12 w-12"
        hidden={revealAll ? revealed : hidden}
        {revealed}
        onFlip={() => {
          lotoStore.superGameRevealedIds.push(idx)
        }}
      />
    {/each}
  </div>
{/if}
</div>

<style>
  :global(.round-container) {
    border-radius: 50%;
    border: 2px solid #e24040;
    background: #f4e1c7;
    font-family: monospace;
    font-size: 1.3rem;
    color: black;
  }

  :global(.cell) {
    display: flex;
    align-items: center;
    justify-content: center;

    width: 3rem;
    height: 3rem;

    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;

    background: rgba(255, 255, 255, 0.03);

    box-shadow: 0 0 18px rgba(255, 255, 255, 0.04);
  }

  :global(.cell-text) {
    display: flex;
    align-items: center;
    justify-content: center;

    width: 2rem;
    height: 2rem;

    font-weight: 700;
    color: white;

    border-radius: 9999px;
  }

  :global(.cell-highlight) {
    transform: scale(1.1);

    background: rgba(255, 215, 0, 0.14);

    box-shadow: 0 0 18px rgba(255, 215, 0, 0.35);
  }

  :global(.cell-highlight .cell-text) {
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.7);
  }

  :global(.cell-highlight::after) {
    content: '';

    position: absolute;
    inset: 0;

    border-radius: 9999px;
    background: rgba(255, 215, 0, 0.12);
    pointer-events: none;
  }
</style>

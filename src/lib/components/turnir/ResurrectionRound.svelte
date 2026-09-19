<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { PRAY_IMG } from '$lib/constants'
  import { getMusicStore } from '$lib/stores/musicStore.svelte'
  import type { Item } from '$lib/turnir/types'
  import InfoPanel from './InfoPanel.svelte'
  import ResurrectionVoting from './ResurrectionVoting.svelte'
  import Wheel from './Wheel.svelte'

  type Props = {
    activeItems: Item[]
    eliminatedItems: Item[]
    onItemResurrection: (id: string) => void
    subscriberOnly: boolean
  }

  let { activeItems, eliminatedItems, onItemResurrection, subscriberOnly }: Props = $props()

  type Phase = 'initial' | 'random' | 'voting'

  const musicStore = getMusicStore()

  $effect(() => {
    musicStore.play('raphael')
    return () => musicStore.stop()
  })

  // Component is keyed by roundId, so local phase always starts fresh.
  let phase = $state<Phase>('initial')
</script>

{#if eliminatedItems.length === 0}
  <p class="text-muted-foreground">Пока некого воскрешать — скипните раунд.</p>
{:else if phase === 'initial'}
  <div class="flex flex-col items-center">
    <InfoPanel>
      <p>Выбери вариант воскрешения</p>
    </InfoPanel>
    <div class="mt-4 flex gap-2">
      <Button class="bg-green-600 hover:bg-green-500" onclick={() => (phase = 'random')}>
        Случайное
      </Button>
      <Button variant="destructive" onclick={() => (phase = 'voting')}>
        Выбор чата (скрытое голосование)
      </Button>
    </div>
  </div>
{:else if phase === 'random'}
  <Wheel
    items={eliminatedItems}
    onItemWinning={onItemResurrection}
    confirmLabel="Воскресить"
    confirmVariant="default"
    music="nightsong"
    centerImage={PRAY_IMG}
  />
{:else}
  <ResurrectionVoting items={eliminatedItems} {onItemResurrection} {subscriberOnly} />
{/if}

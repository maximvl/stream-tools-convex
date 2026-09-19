<script lang="ts">
  import { createItem, type Item } from '$lib/turnir/types'
  import InfoPanel from './InfoPanel.svelte'
  import Wheel from './Wheel.svelte'

  const SAVED_ID = '1'
  const ELIMINATED_ID = '2'

  type Props = {
    dealItem: Item
    onItemReturn: (id: string) => void
    onItemElimination: (id: string) => void
  }

  let { dealItem, onItemReturn, onItemElimination }: Props = $props()

  const wheelItems = [createItem(SAVED_ID, 'Возвращается'), createItem(ELIMINATED_ID, 'Выбывает')]

  function handleWinning(winnerId: string) {
    if (winnerId === SAVED_ID) {
      onItemReturn(dealItem.id)
    } else {
      onItemElimination(dealItem.id)
    }
  }

  function confirmFor(winner: Item) {
    if (winner.id === SAVED_ID) {
      return { label: 'Вернуть в турнир', variant: 'default' as const }
    }
    return { label: 'Удалить из турнира', variant: 'destructive' as const }
  }
</script>

<div class="flex flex-col items-center">
  <InfoPanel>
    <p>
      {dealItem.title}
      <br />
      должен заплатить за счастливый билетик
    </p>
  </InfoPanel>
  <div class="mt-4">
    <Wheel items={wheelItems} onItemWinning={handleWinning} getConfirmButton={confirmFor} />
  </div>
</div>

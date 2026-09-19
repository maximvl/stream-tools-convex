<script lang="ts">
  import * as Dialog from '../ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Label } from '$lib/components/ui/label'
  import { Settings } from '@lucide/svelte'
  import {
    ClassicRoundTypes,
    ImplementedBonusRounds,
    RoundTypeNames,
    RoundTypeTooltip,
  } from '$lib/turnir/types'
  import { defaultTurnirSettings, type TurnirStore } from '$lib/stores/turnirStore.svelte'

  type Props = {
    store: TurnirStore
  }

  let { store }: Props = $props()

  let open = $state(false)

  function resetSettings() {
    store.settings.value = defaultTurnirSettings()
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>
    <Button variant="outline"><Settings />Настройки</Button>
  </Dialog.Trigger>
  <Dialog.Content class="bg-card2">
    <Dialog.Header>Настройки турнира</Dialog.Header>
    {#if !store.canEditItems}
      <p class="text-sm text-muted-foreground">Настройки доступны только до запуска турнира.</p>
    {/if}
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2" title="Один и тот же раунд не будет повторяться подряд">
        <Checkbox
          id="turnir-no-round-repeat"
          bind:checked={store.settings.value.noRoundRepeat}
          disabled={!store.canEditItems}
        />
        <Label for="turnir-no-round-repeat" class="cursor-pointer">Антиповтор раундов</Label>
      </div>
      <div class="flex items-center gap-2" title="Только сабы будут учитываться в голосованиях">
        <Checkbox
          id="turnir-subscriber-only"
          bind:checked={store.settings.value.subscriberOnly}
          disabled={!store.canEditItems}
        />
        <Label for="turnir-subscriber-only" class="cursor-pointer">Только для САБОВ</Label>
      </div>
      <div class="flex flex-col gap-2">
        <p class="text-sm font-bold">Классические раунды</p>
        {#each ClassicRoundTypes as roundType (roundType)}
          <div class="flex items-center gap-2" title={RoundTypeTooltip[roundType] ?? ''}>
            <Checkbox
              id={`turnir-round-${roundType}`}
              checked={store.settings.value.roundTypes[roundType]}
              onCheckedChange={(v: boolean) => {
                store.settings.value.roundTypes[roundType] = v
              }}
              disabled={!store.canEditItems}
            />
            <Label for={`turnir-round-${roundType}`} class="cursor-pointer">
              {RoundTypeNames[roundType]}
            </Label>
          </div>
        {/each}
      </div>
      <div class="flex flex-col gap-2">
        <p class="text-sm font-bold">Бонусные раунды (один раз за турнир)</p>
        {#each ImplementedBonusRounds as roundType (roundType)}
          <div class="flex items-center gap-2" title={RoundTypeTooltip[roundType] ?? ''}>
            <Checkbox
              id={`turnir-round-${roundType}`}
              checked={store.settings.value.roundTypes[roundType]}
              onCheckedChange={(v: boolean) => {
                store.settings.value.roundTypes[roundType] = v
              }}
              disabled={!store.canEditItems}
            />
            <Label for={`turnir-round-${roundType}`} class="cursor-pointer">
              {RoundTypeNames[roundType]}
            </Label>
          </div>
        {/each}
      </div>
      <Button variant="destructive" onclick={resetSettings} disabled={!store.canEditItems}>
        Сбросить настройки
      </Button>
    </div>
  </Dialog.Content>
</Dialog.Root>

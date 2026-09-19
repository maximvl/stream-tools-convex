<script lang="ts">
  import { Play, Plus, RotateCcw, SkipForward, Volume2, VolumeOff } from '@lucide/svelte'
  import { onDestroy } from 'svelte'
  import ConnectionDialog from '$lib/components/connections/ConnectionDialog.svelte'
  import Nav from '$lib/components/layout/Nav.svelte'
  import { Button } from '$lib/components/ui/button'
  import ItemsList from '$lib/components/turnir/ItemsList.svelte'
  import MusicAudio from '$lib/components/turnir/MusicAudio.svelte'
  import ProtectionRevealDialog from '$lib/components/turnir/ProtectionRevealDialog.svelte'
  import RoundContent from '$lib/components/turnir/RoundContent.svelte'
  import SwapRevealDialog from '$lib/components/turnir/SwapRevealDialog.svelte'
  import RoundTitle from '$lib/components/turnir/RoundTitle.svelte'
  import SkipRoundDialog from '$lib/components/turnir/SkipRoundDialog.svelte'
  import TurnirSettingsDialog from '$lib/components/turnir/TurnirSettingsDialog.svelte'
  import Victory from '$lib/components/turnir/Victory.svelte'
  import { MusicStore, setMusicStore } from '$lib/stores/musicStore.svelte'
  import { TurnirStore } from '$lib/stores/turnirStore.svelte'

  const store = new TurnirStore()
  const music = new MusicStore()
  setMusicStore(music)

  let showSkipDialog = $state(false)

  // Victory fanfare on win, silence on restart. Round-specific tracks are
  // started by the round components themselves on mount.
  $effect(() => {
    if (store.turnirState === 'Victory') {
      music.play('victory')
    } else if (store.turnirState === 'EditCandidates') {
      music.stop()
    }
  })

  onDestroy(() => music.stop())
</script>

<svelte:head>
  <title>Турнир</title>
</svelte:head>

<div class="dark flex min-h-screen flex-col items-center p-8">
  <Nav />

  <div class="mb-8 flex w-full max-w-7xl items-center">
    <div class="w-[250px]">
      <ConnectionDialog />
    </div>
    <div class="flex-1 text-center">
      <h1 class="text-4xl font-extrabold tracking-tight">Турнир</h1>
    </div>
    <div class="flex w-[250px] items-center justify-end gap-2">
      <Button
        variant="outline"
        size="icon"
        onclick={() => music.toggleMute()}
        title={music.muted.value ? 'Включить звук' : 'Выключить звук'}
      >
        {#if music.muted.value}
          <VolumeOff />
        {:else}
          <Volume2 />
        {/if}
      </Button>
      <input
        type="range"
        aria-label="Громкость музыки"
        title="Громкость музыки"
        class="w-28 accent-primary"
        min={0}
        max={1}
        step={0.01}
        bind:value={music.volume.value}
      />
    </div>
  </div>

  <MusicAudio />

  <div class="relative flex w-full max-w-7xl flex-1 flex-col">
    <div
      class="z-10 flex flex-col gap-4 rounded-3xl border bg-card p-6 lg:absolute lg:top-0 lg:left-0 lg:max-h-full lg:w-[360px] lg:overflow-y-auto lg:shadow-2xl"
    >
      <div class="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={!store.isRoundActive}
          onclick={() => (showSkipDialog = true)}
        >
          <SkipForward /> Скип раунда
        </Button>
        <Button
          variant="destructive"
          disabled={store.turnirState === 'EditCandidates'}
          onclick={() => {
            music.stop()
            store.restartToEdit()
          }}
        >
          <RotateCcw /> Рестарт
        </Button>
        <TurnirSettingsDialog {store} />
      </div>

      <ItemsList
        items={store.items}
        activeItems={store.nonEmptyItems}
        canEditItems={store.canEditItems}
        setItemTitle={(i, text) => store.setItemTitle(i, text)}
        pasteItems={(i, lines) => store.pasteItems(i, lines)}
      />

      {#if store.canEditItems}
        <Button variant="outline" onclick={() => store.addMoreItems()}>
          <Plus /> Добавить слотов
        </Button>
      {/if}
    </div>

    <div
      class="mt-6 flex min-h-[60vh] flex-1 flex-col items-center justify-start rounded-3xl border bg-card p-6 text-center lg:mt-0"
    >
      {#if store.currentRoundType}
        <RoundTitle
          roundNumber={store.roundNumber}
          roundType={store.currentRoundType}
          itemsLeft={store.activeItems.length}
        />
      {:else}
        <h3 class="mt-0 text-xl font-bold text-muted-foreground">Подготовка турнира</h3>
      {/if}
      {#if store.isRoundActive && store.currentRoundType}
        <div class="mt-8 w-full">
          {#key store.roundId}
            <RoundContent
              roundType={store.currentRoundType}
              activeItems={store.activeItems}
              eliminatedItems={store.eliminatedItems}
              dealItem={store.dealItem}
              onItemElimination={(id) => store.eliminateItem(id)}
              onItemProtection={(id) => store.protectItem(id)}
              onItemSwap={(id) => store.applySwap(id)}
              onItemResurrection={(id) => store.resurrectItem(id)}
              onItemDeal={(id) => store.applyDeal(id)}
              onDealReturn={() => store.returnDealItem()}
              subscriberOnly={store.subscriberOnly}
            />
          {/key}
        </div>
      {:else if store.turnirState === 'Victory' && store.winner}
        <Victory winner={store.winner} />
      {:else if store.canEditItems}
        <Button
          class="mt-6 bg-green-600 px-10 py-6 text-lg font-bold hover:bg-green-500"
          disabled={store.nonEmptyItems.length === 0 || store.activeRounds.length === 0}
          onclick={() => {
            music.stop()
            store.startTurnir()
          }}
        >
          <Play /> Запуск
        </Button>
        {#if store.activeRounds.length === 0}
          <p class="mt-2 text-sm text-amber-500">Включи хотя бы один раунд в настройках</p>
        {/if}
      {/if}
    </div>
  </div>
</div>

<SkipRoundDialog
  bind:open={showSkipDialog}
  onClose={() => (showSkipDialog = false)}
  onConfirm={() => {
    showSkipDialog = false
    store.skipRound()
  }}
/>

<ProtectionRevealDialog
  bind:open={store.showProtectionModal}
  item={store.protectionRevealItem}
  onConfirm={() => store.resolveProtectionReveal()}
/>

{#if store.swapRevealItems}
  <SwapRevealDialog
    bind:open={store.showSwapModal}
    initialItem={store.swapRevealItems.initial}
    actionItem={store.swapRevealItems.action}
    onConfirm={() => store.resolveSwapReveal()}
  />
{/if}

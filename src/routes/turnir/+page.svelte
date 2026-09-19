<script lang="ts">
  import { Play, Plus, RotateCcw, SkipForward } from '@lucide/svelte'
  import ConnectionDialog from '$lib/components/connections/ConnectionDialog.svelte'
  import Nav from '$lib/components/layout/Nav.svelte'
  import { Button } from '$lib/components/ui/button'
  import ItemsList from '$lib/components/turnir/ItemsList.svelte'
  import RoundContent from '$lib/components/turnir/RoundContent.svelte'
  import RoundTitle from '$lib/components/turnir/RoundTitle.svelte'
  import SkipRoundDialog from '$lib/components/turnir/SkipRoundDialog.svelte'
  import TurnirSettingsDialog from '$lib/components/turnir/TurnirSettingsDialog.svelte'
  import Victory from '$lib/components/turnir/Victory.svelte'
  import { TurnirStore } from '$lib/stores/turnirStore.svelte'

  const store = new TurnirStore()

  let showSkipDialog = $state(false)
</script>

<svelte:head>
  <title>Турнир</title>
</svelte:head>

<div class="dark flex min-h-screen flex-col items-center p-8">
  <Nav />

  <div class="mb-8 flex w-full max-w-6xl items-center">
    <div class="w-[250px]">
      <ConnectionDialog />
    </div>
    <div class="flex-1 text-center">
      <h1 class="text-4xl font-extrabold tracking-tight">Турнир</h1>
    </div>
    <div class="w-[250px]"></div>
  </div>

  <div class="grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
    <div class="flex flex-col gap-4 rounded-3xl border bg-card p-6">
      <div class="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          disabled={store.turnirState === 'EditCandidates'}
          onclick={() => store.restartToEdit()}
        >
          <RotateCcw /> Рестарт
        </Button>
        <Button
          variant="secondary"
          disabled={!store.isRoundActive}
          onclick={() => (showSkipDialog = true)}
        >
          <SkipForward /> Скипнуть раунд
        </Button>
        <Button
          class="bg-green-600 hover:bg-green-500"
          disabled={store.nonEmptyItems.length === 0 ||
            store.activeRounds.length === 0 ||
            !store.canEditItems}
          onclick={() => store.startTurnir()}
        >
          <Play /> Запуск
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

    <div class="flex flex-col items-center rounded-3xl border bg-card p-6 text-center">
      {#if store.isRoundActive && store.currentRoundType}
        <RoundTitle
          roundNumber={store.roundNumber}
          roundType={store.currentRoundType}
          itemsLeft={store.activeItems.length}
        />
        <div class="mt-4 w-full">
          {#key store.roundId}
            <RoundContent
              roundType={store.currentRoundType}
              activeItems={store.activeItems}
              onItemElimination={(id) => store.eliminateItem(id)}
              subscriberOnly={store.subscriberOnly}
            />
          {/key}
        </div>
      {:else if store.turnirState === 'Victory' && store.winner}
        <Victory winner={store.winner} />
      {:else}
        <p class="text-muted-foreground">
          Заполните участников слева и нажмите «Запуск». Осталось участников: {store.nonEmptyItems
            .length}
        </p>
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

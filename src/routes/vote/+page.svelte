<script lang="ts">
  import ConnectionDialog from '$lib/components/connections/ConnectionDialog.svelte'
  import Nav from '$lib/components/layout/Nav.svelte'
  import { Button } from '$lib/components/ui/button'
  import { getChatStore } from '$lib/context'
  import { VotingStore, setVotingStore } from '$lib/stores/votingStore.svelte'
  import { untrack } from 'svelte'
  import OptionInput from '$lib/components/voting/OptionInput.svelte'
  import VotingOptionCard from '$lib/components/voting/VotingOptionCard.svelte'
  import VotingLog from '$lib/components/voting/VotingLog.svelte'
  import BgPattern5 from '$lib/components/common/BgPattern5.svelte'
  import { BackgroundImages } from '$lib/constants'

  const chatStore = getChatStore()
  const votingStore = new VotingStore()
  setVotingStore(votingStore)

  $effect(() => {
    const messages = chatStore.newMessages
    untrack(() => {
      messages.forEach(votingStore.handleMessage)
    })
  })

  let optionsContainer: HTMLDivElement | null = $state(null)

  const isTimerSet = $derived(votingStore.timer.limitMs > 0)

  const timerValue = $derived(
    isTimerSet
      ? `${votingStore.timer.remainingMinutesPart.toString().padStart(2, '0')}:${votingStore.timer.remainingSecondsPart.toString().padStart(2, '0')}`
      : `${votingStore.timer.passedMinutesPart.toString().padStart(2, '0')}:${votingStore.timer.passedSecondsPart.toString().padStart(2, '0')}`,
  )
</script>

<svelte:head>
  <title>
    {votingStore.votingState === 'voting' ? `${votingStore.totalVotes} голосов` : 'Голосование'}
  </title>
</svelte:head>

<div class="dark flex flex-col items-center p-8">
  <Nav />
</div>

<BgPattern5
  images={BackgroundImages}
  gap={40}
  staggered
  tileSize={50}
  polaroidChance={0}
  maxRotation={18}
  tapeChance={0}
/>

{#snippet votingOptions()}
  <div bind:this={optionsContainer} class="flex w-full max-w-3xl flex-col gap-4 rounded-xl">
    {#each votingStore.optionStats as stat, index (stat.id)}
      {@const isWinner =
        votingStore.winners.some((w) => w.id === stat.id) && votingStore.votingState === 'ended'}
      {@const serverCounts = votingStore.votesPerServerPerOption[index]}
      <VotingOptionCard {index} {stat} {serverCounts} {isWinner} showWinnerBadge={true} />
    {/each}
  </div>
{/snippet}

{#snippet votingLog()}
  <div
    class="bg-card2 flex w-full max-w-xl flex-col gap-4 overflow-auto rounded-xl"
    style={`height:${optionsContainer?.offsetHeight ?? 0}px`}
  >
    <VotingLog />
  </div>
{/snippet}

<div class="dark relative flex min-h-screen flex-col overflow-hidden p-6 pt-0">
  <div class="mb-12 flex w-full max-w-6xl items-center self-center">
    <div class="w-[250px]">
      <ConnectionDialog />
    </div>
    <div class="flex-1 text-center">
      <h1 class="text-4xl font-extrabold tracking-tight">Голосование чата</h1>
    </div>
    <div class="w-[250px]"></div>
  </div>

  <div class="flex flex-1 flex-col items-center justify-start gap-8">
    {#if votingStore.votingState === 'idle'}
      <!-- IDLE / CONFIGURATION STATE -->
      <div
        class="bg-card2 w-full max-w-xl rounded-3xl border border-primary/20 p-8 shadow-2xl backdrop-blur-md"
      >
        <h2 class="mb-2 text-2xl font-black text-primary uppercase">Варианты</h2>
        <p class="mb-6 text-sm text-muted-foreground">
          Укажите варианты ответа. Во время голосования зрители смогут отправлять в чат порядковый
          номер варианта (1, 2, 3...) для участия.
        </p>
        <div class="flex flex-col gap-3">
          {#each votingStore.options as option, index (option.id)}
            <OptionInput
              {index}
              bind:value={option.text}
              showDelete={votingStore.options.length > 2}
              onUpdate={(val) => votingStore.updateOption(index, val)}
              onDelete={() => votingStore.removeOption(index)}
            />
          {/each}
        </div>

        <Button
          variant="outline"
          class="mt-4 w-full gap-2 rounded-xl border-primary/20 hover:bg-primary/5"
          onclick={() => votingStore.addOption()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg
          >
          Добавить вариант
        </Button>

        <div class="mt-4 text-lg">Таймер</div>
        <div class="mt-4 flex items-center gap-2">
          <div class="flex flex-col">
            <div
              class="flex h-16 items-center justify-center rounded-2xl border-2 px-6 shadow-lg ring-1 transition-all {votingStore
                .timer.remainingSeconds <= 30 && isTimerSet
                ? 'animate-pulse border-red-500/80 bg-red-500/30 ring-red-500/50'
                : 'border-primary/60 bg-card ring-primary/40'}"
            >
              <div class="flex items-center gap-2">
                <div
                  class="text-3xl font-black {votingStore.timer.remainingSeconds <= 30 && isTimerSet
                    ? 'text-red-500'
                    : 'text-primary'}"
                >
                  {#if !isTimerSet}
                    --
                  {:else}
                    {timerValue}
                  {/if}
                </div>
              </div>
            </div>
          </div>
          <div class="flex w-full gap-2">
            <Button
              class="h-auto flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black tracking-tighter uppercase shadow-lg transition-all hover:scale-105 hover:bg-blue-500 active:scale-95"
              onclick={() => (votingStore.timer.limitMs += 60 * 1000)}
            >
              +1 мин
            </Button>
            <Button
              class="h-auto flex-1 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black tracking-tighter uppercase shadow-lg transition-all hover:scale-105 hover:bg-purple-500 active:scale-95"
              onclick={() => (votingStore.timer.limitMs += 30 * 1000)}
            >
              +30 сек
            </Button>
            <Button
              class="h-auto flex-1 rounded-xl bg-orange-600 px-4 py-2 text-sm font-black tracking-tighter uppercase shadow-lg transition-all hover:scale-105 hover:bg-orange-500 active:scale-95"
              onclick={() => (votingStore.timer.limitMs = 0)}
            >
              Сбросить
            </Button>
          </div>
        </div>

        <Button
          class="mt-8 w-full rounded-2xl bg-green-600 py-6 text-lg font-black shadow-xl transition-all hover:scale-105 hover:bg-green-500 active:scale-95"
          onclick={() => votingStore.startVoting()}
        >
          Начать голосование
        </Button>
      </div>
    {:else if votingStore.votingState === 'voting'}
      <!-- VOTING IN PROGRESS STATE -->
      <div
        class="bg-card2 mb-8 w-full max-w-xl rounded-2xl border border-primary/20 px-8 py-6 text-center shadow-lg ring-1 ring-primary/5"
      >
        <p class="text-xl font-extrabold tracking-wide text-primary uppercase">Идет голосование!</p>
        <p class="mt-2 text-sm text-muted-foreground">
          Напишите в чат цифру <span
            class="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-bold text-primary"
            >1, 2, 3...</span
          > чтобы отдать свой голос
        </p>

        <div class="mt-4 flex flex-wrap items-center justify-center gap-8">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-muted-foreground">
              Всего голосов: {votingStore.totalVotes}
            </span>
          </div>

          <div
            class="flex h-16 items-center justify-center rounded-2xl border-2 px-6 shadow-lg ring-1 transition-all {votingStore
              .timer.remainingSeconds <= 30 && isTimerSet
              ? 'animate-pulse border-red-500/80 bg-red-500/30 ring-red-500/50'
              : 'border-primary/60 bg-card ring-primary/40'}"
          >
            <div class="flex items-center gap-2">
              <div
                class="text-3xl font-black {votingStore.timer.remainingSeconds <= 30 && isTimerSet
                  ? 'text-red-500'
                  : 'text-primary'}"
              >
                {timerValue}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex h-full w-full justify-center gap-10">
        {@render votingLog()}
        {@render votingOptions()}
      </div>

      <div class="mt-8 flex justify-center gap-4">
        <Button
          variant="destructive"
          class="rounded-xl bg-red-700! px-8 py-5 text-sm font-semibold transition-all hover:scale-105"
          onclick={() => votingStore.resetVoting()}
        >
          Сбросить
        </Button>
        <Button
          variant="default"
          class="rounded-xl bg-purple-600 px-10 py-5 text-sm font-bold shadow-lg transition-all hover:scale-105 hover:bg-purple-500 active:scale-95"
          onclick={() => votingStore.endVoting()}
        >
          Завершить
        </Button>
      </div>
    {:else if votingStore.votingState === 'ended'}
      <!-- VOTING ENDED / RESULTS STATE -->
      <div
        class="bg-card2 mb-8 flex w-full max-w-xl flex-col items-center rounded-2xl border border-yellow-500/20 px-6 py-4 text-center shadow-lg"
      >
        <p class="text-xl">Победитель</p>
        <p class="text-2xl font-extrabold text-yellow-500 uppercase">
          {#if votingStore.winners.length > 1}
            Уравнители
          {:else}
            {votingStore.winners[0]?.text || 'Нет данных'}
          {/if}
        </p>
        <p class="mt-1">
          Всего голосов: {votingStore.totalVotes}
        </p>
      </div>

      <div class="flex h-full w-full justify-center gap-10">
        {@render votingLog()}
        {@render votingOptions()}
      </div>

      <div class="mt-8 flex justify-center gap-4">
        <Button
          class="rounded-xl bg-blue-600 px-10 py-5 text-sm font-bold shadow-lg transition-all hover:scale-105 hover:bg-blue-500 active:scale-95"
          onclick={() => votingStore.resetVoting()}
        >
          Новое голосование
        </Button>
      </div>
    {/if}
    <div class="mt-50"></div>
  </div>
</div>

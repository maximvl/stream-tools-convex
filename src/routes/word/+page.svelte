<script lang="ts">
  import ConnectionDialog from '$lib/components/connections/ConnectionDialog.svelte'
  import { WordDisplay } from '$lib/components/ui/word-display'
  import { getChatStore } from '$lib/context'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
  import Nav from '$lib/components/layout/Nav.svelte'

  const store = getChatStore()
  let word = $state('')
  let isWordSet = $state(false)
  let isRevealed = $state(false)

  const filteredMessages = $derived.by(() => {
    if (!isWordSet || word.trim() === '') return []
    return store.messages.filter((m) => m.text.trim().length === word.trim().length)
  })

  const winnerMessage = $derived.by(() => {
    if (!isWordSet || word.trim() === '') return null
    const target = word.trim().toLowerCase()
    return (
      store.messages
        .filter((m) => m.text.trim().toLowerCase() === target)
        .toSorted((a, b) => a.timestampMs - b.timestampMs)[0] || null
    )
  })

  const displayMessages = $derived.by(() => {
    const messages = isWordSet ? filteredMessages : store.messages
    if (winnerMessage) {
      const index = messages.findIndex((m) => m.id === winnerMessage.id)
      if (index !== -1) {
        return messages.slice(0, index + 1).toReversed()
      }
    }
    return messages.toReversed()
  })

  $effect(() => {
    if (winnerMessage) {
      isRevealed = true
    }
  })

  function setWord() {
    if (word.trim() !== '') {
      isWordSet = true
      isRevealed = false
    }
  }

  function resetGame() {
    word = ''
    isWordSet = false
    isRevealed = false
  }
</script>

<div class="dark flex min-h-screen flex-col items-center p-8">
  <Nav />

  <div class="mb-12 flex w-full max-w-6xl items-center">
    <div class="w-[250px]">
      <ConnectionDialog />
    </div>
    <div class="flex-1 text-center">
      <h1 class="text-4xl font-extrabold tracking-tight">Угадай слово</h1>
    </div>
    <div class="flex w-[250px] justify-end">
      {#if isWordSet}
        <Button variant="outline" onclick={resetGame}>Новое слово</Button>
      {/if}
    </div>
  </div>

  <div class="flex w-full flex-col items-center gap-8">
    {#if !isWordSet}
      <div class="flex w-[400px] flex-col gap-4 text-center">
        <div class="flex gap-2">
          <Input
            type="text"
            placeholder="Слово для угадывания"
            style="-webkit-text-security: disc;"
            bind:value={word}
            onkeydown={(e) => e.key === 'Enter' && setWord()}
          />
          <Button onclick={setWord}>Начать</Button>
        </div>
      </div>
    {:else}
      <div class="flex flex-col items-center gap-6">
        <div class="flex flex-col items-center gap-4">
          <WordDisplay {word} revealed={isRevealed} />
        </div>

        {#if winnerMessage}
          <div
            class="mt-10 animate-bounce rounded-2xl border-4 border-yellow-400 bg-yellow-50 p-6 text-center shadow-xl dark:bg-yellow-900/20"
          >
            <h3 class="mb-2 text-2xl font-black text-yellow-600 uppercase">Победитель!</h3>
            <div class="text-lg">
              <span class="font-bold text-primary">{winnerMessage.user.displayName}</span>
              угадал слово:
              <span class="font-black text-yellow-600 uppercase">{winnerMessage.text}</span>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <div class="flex w-[500px] flex-col gap-4">
      <h2 class="text-lg font-semibold">Догадки</h2>
      <div
        class="flex max-h-[500px] flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-6 shadow-sm"
      >
        {#if displayMessages.length === 0}
          <div class="py-12 text-center text-muted-foreground italic">
            {isWordSet ? 'Нет подходящих догадок...' : 'Пока сообщений нет...'}
          </div>
        {:else}
          {#each displayMessages as message (message.id)}
            {@const isWinner =
              isWordSet && message.text.trim().toLowerCase() === word.trim().toLowerCase()}
            <div
              class="flex gap-3 text-sm leading-relaxed transition-colors {isWinner
                ? 'rounded-lg bg-yellow-400/20 p-2 font-bold ring-2 ring-yellow-400/50'
                : ''}"
            >
              <span class="font-bold text-primary">{message.user.displayName}:</span>
              <span class="text-card-foreground/90">{message.text}</span>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>

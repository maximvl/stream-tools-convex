<script lang="ts">
  import { getLotoStore } from '$lib/stores/lotoStore.svelte'
  import { cn } from '$lib/utils'
  import PlayerName from '../PlayerName.svelte'
  import UserBadges from '../UserBadges.svelte'
  import SuperGameBox from './SuperGameBox.svelte'

  const lotoStore = getLotoStore()
  const user = $derived(
    lotoStore.winner ? lotoStore.usersById.get(lotoStore.winner.owner_id) : undefined,
  )

  function guessStatus(guess: number) {
    if (!lotoStore.superGameRevealedIds.includes(guess)) {
      return 'hidden'
    }
    if (lotoStore.superGameValues[guess].kind === 'empty') {
      return 'empty'
    }
    if (lotoStore.superGameValues[guess].kind === 'bomb') {
      return 'bomb'
    }
    return 'score'
  }
</script>

{#if lotoStore.winner}
  {#key lotoStore.winner}
    {#if lotoStore.superGameState === 'not_started'}
      <div
        class="rounded-xl border border-primary/20 bg-card px-6 py-3 shadow-lg ring-1 ring-primary/5"
      >
        <p class="text-base font-medium text-primary">
          для участия в супер-игре пиши в чат {lotoStore.config.value.super_game_guesses_amount} чисел
          <br />шанс победы: {Math.round(lotoStore.superGameWinChance * 100)}%
        </p>
      </div>
    {:else}
      <div class="flex flex-col gap-4">
        <div class="flex gap-2 text-center text-4xl font-black tracking-wide text-white items-center justify-center">
          <div>Супер-игра с</div>
          <div class="flex gap-1 items-center">
            <PlayerName {user} name={lotoStore.winner.owner_name} />
            {#if user}
              <UserBadges {user} />
            {/if}
          </div>
        </div>

        <div class="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-5">
          <!-- SCORE -->
          <div
            class="flex items-center justify-center gap-2 text-center text-2xl font-bold text-white"
          >
            <span class="opacity-80">Очки</span>

            <div
              class={cn('rounded-full border border-yellow-300/20 bg-yellow-300/10 px-4 py-1', {
                'bg-green-500/30':
                  lotoStore.superGameScore >= lotoStore.config.value.super_game_win_score,
              })}
            >
              <span>
                {lotoStore.superGameScore}
              </span>

              <span class="mx-1 opacity-50">/</span>

              <span class="opacity-70">
                {lotoStore.config.value.super_game_win_score}
              </span>
            </div>
          </div>

          <!-- GUESSES -->
          <div class="flex flex-wrap items-center justify-center gap-3">
            {#each Array.from({ length: lotoStore.superGameTotalGuessesAmount }, (_, i) => i) as id (id)}
              {@const guess = lotoStore.superGameGuesses[id]}
              {@const status = guessStatus(guess - 1)}

              <div
                class={cn(
                  'relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 font-mono text-lg  text-white transition-all duration-500',
                  status === 'hidden' && 'bg-white/5',
                  status === 'score' && 'bg-green-500/30',
                  status === 'empty' && 'bg-yellow-500/30',
                  status === 'bomb' && 'bg-red-500/50',
                )}
              >
                {(guess ?? '__').toString().padStart(2, '0')}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <SuperGameBox />
  {/key}
{/if}

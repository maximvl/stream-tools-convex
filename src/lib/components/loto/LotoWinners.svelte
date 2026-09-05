<script lang="ts">
  import { EZ_SMILE_IMG, GAGA_SMILE_IMG } from '$lib/constants'
  import { getChatStore } from '$lib/context'
  import { type ChatServer } from '$lib/types'
  import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
  import { getLotoStore } from '$lib/stores/lotoStore.svelte'
  import ServerIcon from '../common/ServerIcon.svelte'
  import WinnersChannel from './WinnersChannel.svelte'

  const messagesStore = getChatStore()
  const lotoStore = getLotoStore()

  function formatTime(timestamp: number) {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      month: 'short',
      day: 'numeric',
    })
    const parts = formatter.formatToParts(new Date(timestamp * 1000))
    return parts
      .filter((p) => p.type !== 'literal' || p.value.trim() !== 'г.')
      .map((p) => (p.value.endsWith('.') ? p.value.slice(0, -1) : p.value))
      .join('')
  }
</script>

{#each messagesStore.connectedConnections as connKey (connKey)}
  <WinnersChannel {connKey} />
{/each}

<div
  class="bg-card2 flex max-w-70 flex-col gap-2 rounded-lg p-2"
  role="region"
  aria-label="Прошлые победители"
>
  <div>Прошлые победители</div>
  <div class="mt-4 max-h-screen overflow-y-auto pr-4">
    {#each lotoStore.winnersFlatSorted as winner (`${winner.id}-${winner.created_at}-${winner.stream_channel}`)}
      {@const [server, channel] = winner.stream_channel.split('/')}
      <div class="flex items-center gap-2">
        <ServerIcon
          server={server as ChatServer}
          {channel}
          status="connected"
          class="h-4 w-4 shrink-0 opacity-70 transition-opacity hover:opacity-100"
        />
        <span class="text-sm text-muted-foreground">{formatTime(winner.created_at)}</span>
        <span class="truncate text-lg font-bold">{winner.username}</span>

        <Tooltip>
          <TooltipTrigger>
            {#if winner.super_game_status === 'win'}
              <img src={EZ_SMILE_IMG} class="h-6 w-6" alt="win" />
            {:else if winner.super_game_status === 'lose'}
              <img src={GAGA_SMILE_IMG} class="h-6 w-6" alt="lose" />
            {/if}
          </TooltipTrigger>
          <TooltipContent>
            {winner.super_game_status === 'win' ? 'Победил в супер-игре' : 'Проиграл в супер-игре'}
          </TooltipContent>
        </Tooltip>
      </div>
    {/each}
    <div class="mt-100"></div>
  </div>
</div>

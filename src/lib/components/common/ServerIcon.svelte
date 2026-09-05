<script lang="ts">
  import { ServerIcons } from '$lib/constants'
  import type { ChatServer, ConnectionStatus } from '$lib/types'
  import { cn } from '$lib/utils'
  import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

  type Props = {
    server: ChatServer
    channel?: string
    class?: string
    status: ConnectionStatus
    disableTooltip?: boolean
  }

  let { server, channel, class: className = '', status, disableTooltip = false }: Props = $props()
  const inactive = $derived(status === 'disconnected')
  const loading = $derived(status === 'connecting')
</script>

{#if disableTooltip}
  <img
    class={cn('h-4 w-4', className, inactive && 'opacity-30 grayscale', loading && 'strong-pulse')}
    src={ServerIcons[server]}
    alt="{server} icon"
  />
{:else}
  <Tooltip delayDuration={0}>
    <TooltipTrigger>
      <img
        class={cn('h-4 w-4', className, inactive && 'opacity-30 grayscale', loading && 'strong-pulse')}
        src={ServerIcons[server]}
        alt="{server} icon"
      />
    </TooltipTrigger>
    <TooltipContent>
      <p>{server}{channel ? `/${channel}` : ''}</p>
    </TooltipContent>
  </Tooltip>
{/if}


<style>
  @keyframes strong-pulse {
    0%, 100% {
      filter: grayscale(1);
      transform: scale(1);
    }
    50% {
      filter: grayscale(0.7);
      transform: scale(1.08);
    }
  }
  .strong-pulse {
    animation: strong-pulse 1s ease-in-out infinite;
  }
</style>
<script lang="ts">
  import type { ChatServer } from '$lib/types'
  import { cn } from '$lib/utils'
  import type { LotoTicket } from './types'
  import ServerIcon from '../common/ServerIcon.svelte'

  type Props = {
    tickets: LotoTicket[]
    class?: string
  }

  let { tickets, class: className }: Props = $props()

  const ticketsByPlatform = $derived.by(() => {
    const counts: Record<string, number> = {}
    tickets.forEach((ticket) => {
      const platform = ticket.source.server
      counts[platform] = (counts[platform] || 0) + 1
    })
    return counts
  })

  const platforms = $derived(
    Object.entries(ticketsByPlatform)
      .toSorted(([_, a], [__, b]) => b - a)
      .map(([key]) => key as ChatServer)
  )
</script>

<div class={cn('flex items-center justify-center', className)}>
  {#each platforms as platform (platform)}
    <div class="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-1.5">
      <ServerIcon server={platform} status='connected' />
      <span class="text-xl font-bold text-muted-foreground">
        {ticketsByPlatform[platform]}
      </span>
    </div>
  {/each}
</div>

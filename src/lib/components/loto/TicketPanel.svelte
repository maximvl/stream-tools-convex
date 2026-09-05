<script lang="ts">
  import { getChatStore } from '$lib/context'
  import { getLotoStore } from '$lib/stores/lotoStore.svelte'
  import { Button } from '../ui/button'
  import * as Tooltip from '../ui/tooltip'
  import type { LotoTicket } from './types'

  type Props = {
    ticket: LotoTicket
  }

  const { ticket }: Props = $props()

  const chatStore = getChatStore()
  const lotoStore = getLotoStore()

  const userMessages = $derived(chatStore.messagesByUser.get(ticket.owner_id) || [])
  const sortedMessages = $derived(userMessages.toSorted((a, b) => a.timestampMs - b.timestampMs))

  const messagesAmount = $derived(sortedMessages.length)
  let messagesContainer: HTMLDivElement | null = null

  $effect(() => {
    void messagesAmount
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }
  })
</script>

<div
  class="bg-card2 col-start-1 row-start-2 w-0 min-w-full rounded-xl border border-border/80 p-3 wrap-break-word shadow-inner"
>
  <div
    class="flex max-h-40 max-w-full flex-col gap-2 overflow-y-auto text-left"
    bind:this={messagesContainer}
  >
    {#each sortedMessages as msg (msg.id)}
      <div>
        {new Date(msg.timestampMs).toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })}
        :&nbsp;{msg.text}
      </div>
    {/each}
  </div>
  <div class="mt-4 flex justify-end">
    <Tooltip.Root>
      <Tooltip.Trigger>
        <Button
          variant="destructive"
          size="sm"
          onclick={() => {
            lotoStore.deleteTicket(ticket.id)
          }}
        >
          Удалить билет
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p>Лото продолжится без этого билета</p>
      </Tooltip.Content>
    </Tooltip.Root>
  </div>
</div>

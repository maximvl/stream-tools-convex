<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import type { Item } from '$lib/turnir/types'

  type Props = {
    open: boolean
    initialItem: Item | undefined
    actionItem: Item | undefined
    onConfirm: () => void
  }

  let { open = $bindable(), initialItem, actionItem, onConfirm }: Props = $props()
</script>

<Dialog.Root
  bind:open
  onOpenChange={(o) => {
    if (!o) onConfirm()
  }}
>
  <Dialog.Content class="bg-card2">
    <Dialog.Header>Подмена!</Dialog.Header>
    {#if actionItem?.isProtected}
      <p class="text-sm text-muted-foreground">
        Вместо удаления <span class="text-green-500">{initialItem?.title}</span> снимается защита с
        <span class="text-red-400">{actionItem?.title}</span>!
      </p>
    {:else}
      <p class="text-sm text-muted-foreground">
        Вместо <span class="text-green-500">{initialItem?.title}</span> удаляется
        <span class="text-red-400">{actionItem?.title}</span>!
      </p>
    {/if}
    <div class="mt-4 flex justify-end gap-2">
      <Button
        variant="outline"
        onclick={() => {
          open = false
        }}
      >
        Согласен
      </Button>
    </div>
  </Dialog.Content>
</Dialog.Root>

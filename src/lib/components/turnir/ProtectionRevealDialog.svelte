<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import type { Item } from '$lib/turnir/types'

  type Props = {
    open: boolean
    item: Item | undefined
    onConfirm: () => void
  }

  let { open = $bindable(), item, onConfirm }: Props = $props()
</script>

<Dialog.Root
  bind:open
  onOpenChange={(o) => {
    if (!o) onConfirm()
  }}
>
  <Dialog.Content class="bg-card2">
    <Dialog.Header>Защита!</Dialog.Header>
    <p class="text-sm text-muted-foreground">
      Вместо удаления <span class="text-green-500">{item?.title}</span> с него снимается защита!
    </p>
    <div class="mt-4 flex justify-end gap-2">
      <!--
        onConfirm is called directly: bits-ui only fires onOpenChange on internal
        interactions (overlay/Escape), not on programmatic closes. resolve* is
        idempotent, so a trailing onOpenChange from the close is a safe no-op.
      -->
      <Button variant="outline" onclick={onConfirm}>Согласен</Button>
    </div>
  </Dialog.Content>
</Dialog.Root>

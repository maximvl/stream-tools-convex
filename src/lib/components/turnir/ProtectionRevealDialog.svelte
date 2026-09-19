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

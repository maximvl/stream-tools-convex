<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'

  type Props = {
    open: boolean
    onClose: () => void
    onConfirm: () => void
  }

  let { open = $bindable(), onClose, onConfirm }: Props = $props()
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="bg-card2">
    <Dialog.Header>Скип раунда</Dialog.Header>
    <p class="text-sm text-muted-foreground">
      Скип раунда нужен чтобы скипать баги а не абузить результаты ходов!
    </p>
    <div class="mt-4 flex justify-end gap-2">
      <Button variant="outline" onclick={onClose}>Отмена</Button>
      <Button variant="destructive" onclick={onConfirm}>Скипнуть</Button>
    </div>
  </Dialog.Content>
</Dialog.Root>

<script lang="ts">
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
    import { Trash2 } from '@lucide/svelte'

  type Props = {
    index: number
    value: string
    showDelete: boolean
    onDelete: () => void
    onUpdate: (value: string) => void
  }

  let { index, value = $bindable(), showDelete, onDelete, onUpdate }: Props = $props()
</script>

<div class="flex items-center gap-2">
  <span
    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-foreground bg-muted/40 font-bold"
  >
    {index + 1}
  </span>
  <Input
    type="text"
    placeholder="Текст варианта..."
    {value}
    oninput={(e) => onUpdate(e.currentTarget.value)}
  />
  {#if showDelete}
    <Button
      variant="destructive"
      size="icon"
      onclick={onDelete}
      class="shrink-0"
    >
      <Trash2 />
    </Button>
  {/if}
</div>

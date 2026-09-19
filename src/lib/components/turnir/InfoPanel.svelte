<script lang="ts">
  import type { Snippet } from 'svelte'

  let { children }: { children: Snippet } = $props()
</script>

<div
  class="m-1 w-max rounded-lg border border-sky-500/50 bg-card px-4 py-1 text-sm text-muted-foreground"
>
  {@render children()}
</div>

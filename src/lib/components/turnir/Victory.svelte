<script lang="ts">
  import { Trophy } from '@lucide/svelte'
  import type { Item } from '$lib/turnir/types'

  type Props = {
    winner: Item
  }

  let { winner }: Props = $props()
</script>

<div class="flex flex-col items-center text-center">
  <div
    class="flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-500/15 text-yellow-500"
  >
    <Trophy class="h-8 w-8" />
  </div>
  <h1 class="mt-4 text-3xl font-extrabold">Победитель</h1>
  <p class="mt-2 text-4xl font-black tracking-tight text-yellow-500 uppercase">
    {winner.title}
  </p>
</div>

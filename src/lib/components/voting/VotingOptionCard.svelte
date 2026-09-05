<script lang="ts">
  import ServerIcon from '../common/ServerIcon.svelte'

  type Props = {
    index: number
    stat: { text: string; count: number; percentage: number }
    serverCounts: { twitch?: number; vkvideo?: number; kick?: number }
    isWinner: boolean
    showWinnerBadge: boolean
  }

  let { index, stat, serverCounts, isWinner, showWinnerBadge }: Props = $props()
</script>

<div
  class="relative overflow-hidden rounded-2xl border p-5 transition-all {isWinner
    ? 'bg-card2 border-2 border-yellow-500 shadow-lg ring-1 shadow-yellow-500/5 ring-yellow-500/20'
    : 'bg-card2 border-border/50'}"
>
  <!-- Animated Progress Bar -->
  <div
    class="absolute inset-y-0 left-0 transition-all duration-500 ease-out {isWinner
      ? 'bg-yellow-500/25'
      : 'bg-primary/25'}"
    style="width: {stat.percentage}%"
  ></div>

  <div class="flex items-center justify-between">
    <div class="flex items-center gap-4">
      <span
        class="flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-black {isWinner
          ? 'border-yellow-500/20 bg-yellow-500/20 text-yellow-500 shadow-lg shadow-yellow-500/10'
          : 'border-primary/20 bg-primary/20 text-primary shadow-inner'}"
      >
        {index + 1}
      </span>
      <div>
        <p
          class="text-xl font-bold {isWinner
            ? 'font-extrabold text-yellow-500'
            : 'text-foreground'}"
        >
          {stat.text || `Вариант ${index + 1}`}
        </p>
      </div>
    </div>
    {#if showWinnerBadge && isWinner}
      <div
        class="rounded-full border border-yellow-500/30 bg-yellow-500/20 px-3 py-1 text-[10px] font-black tracking-wider text-yellow-500 uppercase"
      >
        Победитель!
      </div>
    {/if}
    <div
      class="flex gap-10 text-right text-2xl font-black {isWinner
        ? 'text-yellow-500'
        : 'text-primary'}"
    >
      <div>{stat.count}</div>
      <div>{stat.percentage}%</div>
    </div>
  </div>
  <div class="absolute right-0 bottom-0 flex h-6 gap-0">
    {#if serverCounts.twitch !== undefined}
      <div class="flex h-full w-15 items-center justify-center gap-1 bg-purple-500/30">
        <ServerIcon server="twitch" status="connected" />
        {serverCounts.twitch}
      </div>
    {/if}
    {#if serverCounts.vkvideo !== undefined}
      <div class="flex h-full w-15 items-center justify-center gap-1 bg-red-500/30">
        <ServerIcon server="vkvideo" status="connected" />
        {serverCounts.vkvideo}
      </div>
    {/if}
    {#if serverCounts.kick !== undefined}
      <div class="flex h-full w-15 items-center justify-center gap-1 bg-green-500/30">
        <ServerIcon server="kick" status="connected" />
        {serverCounts.kick}
      </div>
    {/if}
  </div>
</div>

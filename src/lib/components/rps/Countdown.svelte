<script lang="ts">
  let { deadline_at }: { deadline_at: number } = $props()

  let now = $state(Date.now())

  $effect(() => {
    const t = setInterval(() => {
      now = Date.now()
    }, 250)
    return () => clearInterval(t)
  })

  const remain = $derived(Math.max(0, deadline_at - now))
  const secs = $derived(Math.ceil(remain / 1000))
  const urgent = $derived(remain <= 5000)
</script>

<span class="font-black tabular-nums {urgent ? 'animate-pulse text-red-500' : 'text-primary'}">
  0:{String(secs).padStart(2, '0')}
</span>

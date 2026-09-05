<script lang="ts">
  import './layout.css'
  import favicon from '$lib/assets/favicon.svg'
  import type { Snippet } from 'svelte'

  // Must run during component initialisation: setupConvex calls setContext.
  import { setupConvex } from 'convex-svelte'
  import { convexUrl } from '$lib/convex'
  if (convexUrl) setupConvex(convexUrl)

  let { children }: { children: Snippet } = $props()

  import { QueryClientProvider } from '@tanstack/svelte-query'
  import { queryClient } from '$lib/context'
  import StoreProvider from './StoreProvider.svelte'
  import { TooltipProvider } from '$lib/components/ui/tooltip'
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<QueryClientProvider client={queryClient}>
  <StoreProvider>
    <TooltipProvider delayDuration={0}>
      {@render children()}
    </TooltipProvider>
  </StoreProvider>
</QueryClientProvider>

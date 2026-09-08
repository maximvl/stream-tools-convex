<script lang="ts">
  import type { ChatServer } from '$lib/types'
  import { cn } from '$lib/utils'
  import ServerIcon from '$lib/components/common/ServerIcon.svelte'
  import PlayerName from '$lib/components/loto/PlayerName.svelte'
  import UserBadges from '$lib/components/loto/UserBadges.svelte'
  import { getRpsChatUsers } from './RpsChatProvider.svelte'

  let {
    name,
    platform,
    userSlug,
    meta,
    dim = false,
  }: {
    name: string
    platform: ChatServer
    userSlug?: string
    meta?: string
    dim?: boolean
  } = $props()

  const chatStore = (() => {
    try {
      return getRpsChatUsers()
    } catch {
      return undefined
    }
  })()

  const user = $derived(
    userSlug !== undefined ? chatStore?.users.get(userSlug.toLowerCase()) : undefined,
  )
</script>

<div class={cn('flex flex-col items-center gap-1', dim && 'opacity-40 grayscale')}>
  <div class="flex items-center gap-1.5">
    <ServerIcon server={platform} status="connected" class="h-5 w-5 shrink-0" disableTooltip />
    <PlayerName {name} {user} />
    {#if user}
      <UserBadges {user} />
    {/if}
  </div>
  {#if meta}
    <span class="text-xs text-muted-foreground">{meta}</span>
  {/if}
</div>

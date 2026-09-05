<script lang="ts">
  import type { ChatUser } from '$lib/types'
  import * as Tooltip from '$lib/components/ui/tooltip'
  import KickModeratorIcon from './KickModeratorIcon.svelte'

  type Props = {
    user: ChatUser
  }

  let { user }: Props = $props()

  const twitchBadges = $derived.by(() => {
    const b = user.twitchFields?.badges || []
    // if (b.length > 1) {
    //   console.log('twitchBadges', b)
    // }
    return b
  })
  const vkRoles = $derived(user.vkFields?.roles || [])
  const vkBadges = $derived(user.vkFields?.badges || [])
  const kickBadges = $derived(user.kickFields?.badges || [])

  const highestPriorityVkRole = $derived.by(() => {
    if (vkRoles.length === 0) return null
    return vkRoles.reduce((highest, current) =>
      current.priority > highest.priority ? current : highest,
    )
  })
</script>

<div class="flex items-center gap-1">
  {#each twitchBadges as badge (badge.title)}
    <Tooltip.Root>
      <Tooltip.Trigger>
        <img
          src={badge.imageUrl}
          alt={badge.title}
          class="h-6 w-6 shrink-0 transition-transform hover:scale-110"
        />
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p>{badge.title}</p>
      </Tooltip.Content>
    </Tooltip.Root>
  {/each}

  {#if highestPriorityVkRole}
    <Tooltip.Root>
      <Tooltip.Trigger>
        <img
          src={highestPriorityVkRole.largeUrl}
          alt={highestPriorityVkRole.name}
          class="h-6 w-6 shrink-0 transition-transform hover:scale-110"
        />
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p>{highestPriorityVkRole.name}</p>
      </Tooltip.Content>
    </Tooltip.Root>
  {/if}

  {#each vkBadges as badge (badge.id)}
    <Tooltip.Root>
      <Tooltip.Trigger>
        <img
          src={badge.largeUrl}
          alt={badge.name}
          class="h-6 w-6 shrink-0 transition-transform hover:scale-110"
        />
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p>{badge.name}</p>
      </Tooltip.Content>
    </Tooltip.Root>
  {/each}

  {#each kickBadges as badge (badge.type)}
    {#if badge.type === 'moderator'}
      <Tooltip.Root>
        <Tooltip.Trigger>
          <KickModeratorIcon />
        </Tooltip.Trigger>
        <Tooltip.Content>
          <p>{badge.name}</p>
        </Tooltip.Content>
      </Tooltip.Root>
    {/if}
  {/each}
</div>

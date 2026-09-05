<script lang="ts">
  import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip'
  import { SuperGameIcons } from '$lib/constants'
  import type { VkRole } from '$lib/types'
  import { cn } from '$lib/utils'
  import type { SuperGameReward } from '../types'

  type Props = {
    class?: string
    reward: SuperGameReward
    emptyPlaceholder?: string
    vkRoles: VkRole[]
  }

  const { reward, vkRoles, class: className = '', emptyPlaceholder = '' }: Props = $props()

  const vkRole = $derived.by(() => {
    if (reward.kind !== 'vk-role') {
      return null
    }
    for (const role of vkRoles) {
      if (role.id === reward.roleId) {
        return role
      }
    }
    return null
  })
</script>

{#if reward.kind === 'empty'}
  <div
    class={cn('flex items-center justify-center text-muted-foreground', className, 'text-base!')}
  >
    {emptyPlaceholder}
  </div>
{:else if vkRole}
  <Tooltip>
    <TooltipTrigger>
      <div class="flex items-center justify-center p-2 {className}">
        <img src={vkRole.largeUrl} class="h-full w-full" alt={vkRole.name} />
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <p>{vkRole.name}</p>
    </TooltipContent>
  </Tooltip>
{:else if reward.kind === 'x1'}
  <Tooltip>
    <TooltipTrigger>
      <div class="flex items-center justify-center p-2 {className}">
        <img src={SuperGameIcons['x1']} class="h-full w-full" alt="x1" />
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <p>1 очко</p>
    </TooltipContent>
  </Tooltip>
{:else if reward.kind === 'x2'}
  <Tooltip>
    <TooltipTrigger>
      <div class="flex items-center justify-center p-2 {className}">
        <img src={SuperGameIcons['x2']} class="h-full w-full" alt="x2" />
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <p>2 очка</p>
    </TooltipContent>
  </Tooltip>
{:else if reward.kind === 'x3'}
  <Tooltip>
    <TooltipTrigger>
      <div class="flex items-center justify-center {className}">
        <img src={SuperGameIcons['x3']} class="h-full w-full" alt="x3" />
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <p>3 очка</p>
    </TooltipContent>
  </Tooltip>
{:else if reward.kind === 'bomb'}
  <Tooltip>
    <TooltipTrigger>
      <div class="flex items-center justify-center p-2 {className}">
        <img src={SuperGameIcons['bomb']} class="h-full w-full" alt="bomb" />
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <p>-1 очко</p>
    </TooltipContent>
  </Tooltip>
{:else}
  <div class="bg-purple-500 {className}"></div>
{/if}

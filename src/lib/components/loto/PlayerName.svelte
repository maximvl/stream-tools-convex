<script lang="ts">
  import type { ChatUser } from '$lib/types'
  import { VkColorsMap } from '$lib/constants'
  import { cn } from '$lib/utils'
  import { isBrightColorOld } from '$lib/utils/color'

  type Props = {
    user?: ChatUser
    name: string
    class?: string
  }

  let { user, name, class: className }: Props = $props()

  const getUserColor = (): string => {
    if (user?.twitchFields?.color) {
      return user.twitchFields.color
    }
    if (user?.vkFields?.nickColor !== undefined) {
      return VkColorsMap[user.vkFields.nickColor] || '#D66E34'
    }
    if (user?.kickFields?.color) {
      return user.kickFields.color
    }
    if (user?.wtvFields?.nicknameColor) {
      return user.wtvFields.nicknameColor
    }
    return '#D66E34'
  }

  const userColor = $derived(getUserColor())

  const isBright = $derived(isBrightColorOld(userColor))
</script>

<span
  class={cn(
    'rounded-sm px-1 font-bold data-[bright=false]:bg-slate-300 data-[bright=true]:bg-slate-800',
    className,
  )}
  data-bright={isBright}
  style="color: {userColor}"
>
  {name}
</span>

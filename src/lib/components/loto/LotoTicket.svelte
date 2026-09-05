<script lang="ts">
  import type { ChatServer, ChatUser } from '$lib/types'
  import { cn } from '$lib/utils'
  import PlayerName from './PlayerName.svelte'
  import UserBadges from './UserBadges.svelte'
  import * as Tooltip from '$lib/components/ui/tooltip'
  import type { LotoTicket } from './types'
  import { TrophyIcon } from '@lucide/svelte'
  import { getLotoStore } from '$lib/stores/lotoStore.svelte'
  import ServerIcon from '../common/ServerIcon.svelte'

  type Props = {
    ticket: LotoTicket
    user: ChatUser
    matchedNumbers?: string[]
    lastRolledNumber?: string
    winnerMatchedNumbers?: string[]
    class?: string
    showTimestamp?: boolean
  }

  let {
    ticket,
    user,
    matchedNumbers = [],
    lastRolledNumber,
    winnerMatchedNumbers = [],
    class: className,
    showTimestamp = false,
  }: Props = $props()

  const isMatched = (num: string) => matchedNumbers.includes(num)
  const isLastRolledMatch = (num: string) => num === lastRolledNumber
  const isWinnerMatch = (num: string) => winnerMatchedNumbers.includes(num)

  const lotoStore = getLotoStore()

  const userWinsTimestamps = $derived(lotoStore.winsByUser[ticket.owner_name] || [])

  // Hash function to convert username to a number
  function hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  // Ticket style options
  // const ticketStyles = [
  //   {
  //     // Style 0: Purple solid
  //     border: 'border-purple-500',
  //     bg: 'bg-purple-900',
  //     shadow: 'shadow-purple-500',
  //     glow: 'hover:shadow-purple-500',
  //   },
  //   {
  //     // Style 1: Blue solid
  //     border: 'border-blue-500',
  //     bg: 'bg-blue-900',
  //     shadow: 'shadow-blue-500',
  //     glow: 'hover:shadow-blue-500',
  //   },
  //   {
  //     // Style 2: Pink solid
  //     border: 'border-pink-500',
  //     bg: 'bg-pink-900',
  //     shadow: 'shadow-pink-500',
  //     glow: 'hover:shadow-pink-500',
  //   },
  //   {
  //     // Style 3: Green solid
  //     border: 'border-green-500',
  //     bg: 'bg-green-900',
  //     shadow: 'shadow-green-500',
  //     glow: 'hover:shadow-green-500',
  //   },
  //   {
  //     // Style 4: Orange solid
  //     border: 'border-orange-500',
  //     bg: 'bg-orange-900',
  //     shadow: 'shadow-orange-500',
  //     glow: 'hover:shadow-orange-500',
  //   },
  //   {
  //     // Style 5: Cyan solid
  //     border: 'border-cyan-500',
  //     bg: 'bg-cyan-900',
  //     shadow: 'shadow-cyan-500',
  //     glow: 'hover:shadow-cyan-500',
  //   },
  //   {
  //     // Style 6: Rose solid
  //     border: 'border-rose-500',
  //     bg: 'bg-rose-900',
  //     shadow: 'shadow-rose-500',
  //     glow: 'hover:shadow-rose-500',
  //   },
  //   {
  //     // Style 7: Indigo solid
  //     border: 'border-indigo-500',
  //     bg: 'bg-indigo-900',
  //     shadow: 'shadow-indigo-500',
  //     glow: 'hover:shadow-indigo-500',
  //   },
  // ]

  const ticketStyles = [
    // {
    //   // Style 0: Warm Stone — neutral anchor, great for a "default" card
    //   border: 'border-stone-500',
    //   bg: 'bg-stone-800',
    //   shadow: 'shadow-stone-900',
    //   glow: 'hover:shadow-stone-600',
    // },
    {
      // Style 1: Deep Wine — rich, desaturated red
      border: 'border-rose-900',
      bg: 'bg-rose-800',
      shadow: 'shadow-rose-950',
      glow: 'hover:shadow-rose-900',
    },
    {
      // Style 2: Burned Terracotta — earthy orange-brown
      border: 'border-orange-900',
      bg: 'bg-orange-800',
      shadow: 'shadow-orange-950',
      glow: 'hover:shadow-orange-900',
    },
    {
      // Style 3: Deep Olive — muted yellow-green, almost bronze in dark mode
      border: 'border-yellow-900',
      bg: 'bg-yellow-800',
      shadow: 'shadow-yellow-950',
      glow: 'hover:shadow-yellow-900',
    },
    {
      // Style 4: Forest Moss — natural, desaturated green
      border: 'border-emerald-900',
      bg: 'bg-emerald-900',
      shadow: 'shadow-emerald-950',
      glow: 'hover:shadow-emerald-900',
    },
    {
      // Style 5: Deep Teal — muted cyan, keeps the cool tones grounded
      border: 'border-teal-800',
      bg: 'bg-teal-800',
      shadow: 'shadow-teal-950',
      glow: 'hover:shadow-teal-800',
    },
    {
      // Style 6: Midnight Indigo — deep blue with a hint of purple
      border: 'border-indigo-900',
      bg: 'bg-indigo-800',
      shadow: 'shadow-indigo-950',
      glow: 'hover:shadow-indigo-900',
    },
    {
      // Style 7: Deep Plum — muted purple, no neon energy
      border: 'border-purple-900',
      bg: 'bg-purple-800',
      shadow: 'shadow-purple-950',
      glow: 'hover:shadow-purple-900',
    },
  ]

  // Select style based on username
  const selectedStyle = $derived(ticketStyles[hashString(user.displayName) % ticketStyles.length])

  function formatTime(timestamp: number) {
    const formatter = new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    const parts = formatter.formatToParts(new Date(timestamp * 1000))
    return parts
      .filter((p) => p.type !== 'literal' || p.value.trim() !== 'г.')
      .map((p) => (p.value.endsWith('.') ? p.value.slice(0, -1) : p.value))
      .join('')
  }
</script>

<div
  class={cn(
    'flex w-fit flex-col gap-3 rounded-xl border p-4 shadow-sm transition-all',
    cn(selectedStyle.border, selectedStyle.bg, selectedStyle.shadow, selectedStyle.glow),
    className,
  )}
>
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-2 text-xl">
      <UserBadges {user} />
      <PlayerName {user} name={ticket.owner_name} class="truncate" />
    </div>
    <div class="flex items-center gap-2">
      {#if ticket.type === 'points'}
        <span
          class="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-sm font-black tracking-wider text-yellow-600 uppercase"
        >
          Бонус
        </span>
      {/if}
      {#if userWinsTimestamps.length > 0}
        <Tooltip.Root>
          <Tooltip.Trigger>
            <div
              class="inline-flex items-center gap-2 rounded-full border border-yellow-500 bg-yellow-900 px-3 py-1 text-yellow-200 shadow"
            >
              <TrophyIcon class="h-4 w-4" />
              <span class="font-bold">{userWinsTimestamps.length}</span>
            </div>
          </Tooltip.Trigger>
          <Tooltip.Content>
            <div class="flex flex-col gap-2">
              <p>Выигрывал {userWinsTimestamps.length} раз</p>
              {#each userWinsTimestamps as winner (winner.id)}
                {@const [server, channel] = winner.stream_channel.split('/')}
                <div class="flex items-center gap-2">
                  <div>{formatTime(winner.created_at)}</div>
                  <ServerIcon server={server as ChatServer} {channel} class="h-4 w-4" status='connected' />
                </div>
              {/each}
            </div>
          </Tooltip.Content>
        </Tooltip.Root>
      {/if}
      <ServerIcon
        server={ticket.source.server}
        channel={ticket.source.channel}
        class="h-6 w-6 shrink-0 transition-opacity hover:opacity-100"
        status='connected'
      />
    </div>
  </div>

  <div class="flex flex-nowrap gap-1.5">
    {#each ticket.value as num, id (id)}
      <div
        class={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 text-2xl font-normal transition-all duration-300',
          isWinnerMatch(num)
            ? 'scale-110 border-green-500 bg-green-500 text-green-950'
            : isLastRolledMatch(num)
              ? 'scale-110 border-orange-500 bg-orange-500 text-orange-950'
              : isMatched(num)
                ? 'scale-105 border-yellow-400 bg-yellow-400 text-yellow-950'
                : 'border-slate-700 bg-slate-800 text-slate-300', // <- changed
        )}
      >
        {num}
      </div>
    {/each}
  </div>
  {#if showTimestamp}
    <div class="text-sm text-white">
      Выдан {new Date(ticket.created_at).toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: 'numeric',
        fractionalSecondDigits: 3,
        hour12: false,
      })}
    </div>
  {/if}
</div>

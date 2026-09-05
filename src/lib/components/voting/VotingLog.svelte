<script lang="ts">
  import { getChatStore } from '$lib/context'
  import { getVotingStore } from '$lib/stores/votingStore.svelte'
  import UserBadges from '$lib/components/loto/UserBadges.svelte'
  import PlayerName from '$lib/components/loto/PlayerName.svelte'
  import ServerIcon from '../common/ServerIcon.svelte'

  const chatStore = getChatStore()
  const votingStore = getVotingStore()
</script>

<div
  class="flex h-full flex-col gap-3 rounded-2xl border border-border/50 bg-card/25 p-6 shadow-sm backdrop-blur-xs"
>
  {#each [...votingStore.votes.values()].sort((a, b) => b.timestamp - a.timestamp) as vote (vote.userId)}
    {@const user = chatStore.usersById.get(vote.userId)!}
    {@const voteChange =
      vote.previousOptionIndex !== undefined && vote.previousOptionIndex !== vote.optionIndex}
    {@const previousOptionText =
      vote.previousOptionIndex !== undefined
        ? votingStore.options[vote.previousOptionIndex]?.text
        : null}
    {@const voteText =
      votingStore.options[vote.optionIndex]?.text || `Вариант ${vote.optionIndex + 1}`}
    <div
      class="flex items-center justify-between gap-3 border-b border-border/10 pb-2 text-sm leading-relaxed last:border-0 last:pb-0"
    >
      <div class="flex items-start gap-0">
        <div class="flex shrink-0 items-center gap-2">
          <span
            >{new Date(vote.timestamp).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <ServerIcon
            server={user.source.server}
            channel={user.source.channel}
            status="connected"
          />
          <UserBadges {user} />
          <PlayerName {user} name={user.displayName} />
        </div>
        <div>
          {#if voteChange}
            <span class="text-muted-foreground/80">
              переобувается с <span class="font-bold text-foreground">{previousOptionText}</span> на
              <span class="font-bold wrap-break-word text-foreground">
                {voteText}
              </span>
            </span>
          {:else}
            <span class="text-nowrap text-muted-foreground/80">
              голосует за <span class="font-bold wrap-break-word text-foreground">
                {voteText}
              </span>
            </span>
          {/if}
        </div>
      </div>
    </div>
  {/each}
</div>

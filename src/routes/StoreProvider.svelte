<script lang="ts">
  import { ChatMessagesStore, connToKey } from '$lib/stores/chatMessagesStore.svelte'
  import ChatChannelSync from '$lib/components/connections/ChatChannelSync.svelte'
  import { setContext } from 'svelte'

  let { children } = $props()

  // Now this runs safely because it's a child of QueryClientProvider
  const store = new ChatMessagesStore()
  setContext('chat-store', store)

  // One stable sync component per configured channel (not per connection
  // state) — mounting follows config edits only, never status flips, so
  // polling observers are never torn down by state changes.
  const channelKeys = $derived(
    Array.from(
      new Set(
        store.connections.value.filter((c) => c.channel.trim() !== '').map((c) => connToKey(c)),
      ),
    ),
  )
</script>

{#each channelKeys as key (key)}
  <ChatChannelSync {store} connKey={key} />
{/each}

{@render children()}

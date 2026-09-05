<script lang="ts">
  import { ChatMessagesStore } from '$lib/stores/chatMessagesStore.svelte'
  import { setContext } from 'svelte'

  let { children } = $props()

  // Now this runs safely because it's a child of QueryClientProvider
  const store = new ChatMessagesStore()
  setContext('chat-store', store)
</script>

{@render children()}

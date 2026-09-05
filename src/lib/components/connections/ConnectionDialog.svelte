<script lang="ts">
  import { getChatStore } from '$lib/context'
  import { untrack } from 'svelte'
  import * as Dialog from '../ui/dialog'
  import ConnectionEdit from './ConnectionEdit.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Separator } from '$lib/components/ui/separator'
  import { Plus } from '@lucide/svelte'
  import { connToKey } from '$lib/stores/chatMessagesStore.svelte'
  import ServerIcon from '../common/ServerIcon.svelte'

  const store = getChatStore()

  let open = $state(false)
  let localConnections = $state<typeof store.connections.value>(store.connections.value)

  $effect(() => {
    if (open) {
      localConnections = store.connections.value
    } else {
      untrack(() => {
        const filtered = localConnections.filter((c) => c.channel.trim() !== '')
        store.updateConnections(filtered)
      })
    }
  })

  function addLocalConnection() {
    localConnections.push({
      server: 'twitch',
      channel: '',
    })
  }

  function removeLocalConnection(index: number) {
    localConnections = localConnections.filter((_, i) => i !== index)
  }

  const activeConnections = $derived(store.connections.value.filter((c) => c.channel.trim() !== ''))
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>
    <div class="bg-card2 rounded-lg w-full">
      <Button variant="outline" class="flex h-auto w-full flex-col px-3 py-1.5">
        <div class="font-medium">Подключение чатов</div>
        <div class="mt-1 flex gap-1.5">
          {#each activeConnections as connection (connToKey(connection))}
            <ServerIcon
              server={connection.server}
              channel={connection.channel}
              status={store.connectionsStatuses[connToKey(connection)] ?? 'disconnected'}
              class="h-6 w-6"
            />
          {/each}
        </div>
      </Button>
    </div>
  </Dialog.Trigger>
  <Dialog.Content class="bg-card2">
    <Dialog.Header>Подключение чатов</Dialog.Header>
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        {#each localConnections as _, i (i)}
          <ConnectionEdit
            bind:connection={localConnections[i]}
            onRemove={() => removeLocalConnection(i)}
          />
        {/each}
      </div>
      <Separator />
      <Button variant="outline" size="sm" onclick={addLocalConnection}>
        <Plus class="mr-2" />
        Добавить
      </Button>
    </div>
  </Dialog.Content>
</Dialog.Root>

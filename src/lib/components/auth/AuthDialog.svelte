<script lang="ts">
  import * as Dialog from '../ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import ServerIcon from '../common/ServerIcon.svelte'
  import type { AuthStore } from '$lib/stores/authStore.svelte'
  import type { ConnKey } from '$lib/stores/chatMessagesStore.svelte'
  import { untrack } from 'svelte'

  let { authStore }: { authStore: AuthStore } = $props()

  let open = $state(false)
  let copiedKey = $state<ConnKey | null>(null)

  function info(key: ConnKey) {
    return (
      authStore.connectionInfo[key] ?? {
        key,
        server: '' as never,
        channel: '',
        authenticated: false,
        isChecking: false,
        isConfirming: false,
      }
    )
  }

  $effect(() => {
    if (open) {
      untrack(() => {
        for (const key of authStore.connections) {
          const conn = authStore.connectionInfo[key]
          if (conn && !conn.authenticated && conn.authKey) {
            authStore.confirmAuth(key, 1)
          }
        }
      })
    }
  })

  async function copyCode(key: ConnKey) {
    const conn = authStore.connectionInfo[key]
    const code = conn?.authKey
    if (!code) return
    await navigator.clipboard.writeText(`+мой ${code}`)
    copiedKey = key
    setTimeout(() => {
      if (copiedKey === key) copiedKey = null
    }, 2000)
    authStore.confirmAuth(key)
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>
    <div>
      <Button class="h-fit w-full">
        <div class="h-fit w-full max-w-50 text-wrap wrap-break-word">
          Подтверди аккаунт для сохранения истории!
        </div>
      </Button>
    </div>
  </Dialog.Trigger>
  <Dialog.Content class="bg-card2">
    <Dialog.Header class="text-xl">Подтверждение аккаунтов</Dialog.Header>
    <div class="">Скопируй код в чат чтобы подтвердить что ты владелец и сохранять историю</div>
    <div class="flex flex-col gap-3">
      {#each authStore.connections as key (key)}
        {@const conn = info(key)}
        <div class="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
          <div class="flex items-center gap-2">
            <ServerIcon
              server={conn.server}
              channel={conn.channel}
              status="connected"
              class="h-6 w-6"
              disableTooltip
            />
            <div class="flex flex-col">
              <span class="font-medium">{conn.channel}</span>
              <span class="text-xs text-muted-foreground">{conn.server}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            {#if conn.authenticated}
              <span class="text-sm font-semibold text-green-500">Подтверждён</span>
            {:else if conn.isChecking || conn.isConfirming}
              <span class="text-sm text-muted-foreground">Проверка…</span>
            {:else if conn.authKey}
              <Button size="sm" onclick={() => copyCode(key)}>
                {copiedKey === key ? 'Скопировано!' : `Скопировать ${conn.authKey}`}
              </Button>
            {:else}
              <span class="text-sm text-muted-foreground">—</span>
            {/if}
          </div>
        </div>
      {/each}
      {#if authStore.connections.length === 0}
        <div class="text-center text-muted-foreground">Нет подключённых чатов</div>
      {/if}
    </div>
    <div class="mt-4">
      <div>Как это работает:</div>
      <ol class="mt-3 ml-6 list-outside list-decimal space-y-1">
        <li>Пользователь отправляет свой уникальный код в чат</li>
        <li>Система видит в чате что код отправлен именно владельцем канала</li>
        <li>Сессия пользователя становится подтвержденной</li>
        <li>Разрешается сохранение истории</li>
      </ol>
    </div>
  </Dialog.Content>
</Dialog.Root>

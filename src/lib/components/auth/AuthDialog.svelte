<script lang="ts">
  import * as Dialog from '../ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import ServerIcon from '../common/ServerIcon.svelte'
  import AuthChannel from './AuthChannel.svelte'
  import type { AuthStore } from '$lib/stores/authStore.svelte'
  import type { ConnKey } from '$lib/stores/chatMessagesStore.svelte'
  import { untrack } from 'svelte'

  let { authStore }: { authStore: AuthStore } = $props()

  let open = $state(false)
  let copied = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | null = null

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

  const unauthedKeys = $derived(
    authStore.connections.filter((key) => !authStore.connectionInfo[key]?.authenticated),
  )
  const authedKeys = $derived(
    authStore.connections.filter((key) => authStore.connectionInfo[key]?.authenticated),
  )
  const allConfirmed = $derived(authStore.connections.length > 0 && unauthedKeys.length === 0)
  // Backend issues one shared code per browser session (see api.auth.check),
  // so the first available key represents all unauthed channels.
  const sharedKey = $derived(
    unauthedKeys
      .map((key) => authStore.connectionInfo[key]?.authKey)
      .find((k): k is string => !!k) ?? null,
  )
  const isBusy = $derived(
    unauthedKeys.some((key) => {
      const c = authStore.connectionInfo[key]
      return c?.isChecking || c?.isConfirming
    }),
  )

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

  async function copyCode() {
    if (!sharedKey) return
    await navigator.clipboard.writeText(`+мой ${sharedKey}`)
    copied = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied = false
    }, 2000)
    for (const key of unauthedKeys) {
      authStore.confirmAuth(key)
    }
  }
</script>

<!-- Reactive per-connection auth subscriptions (no UI). -->
{#each authStore.connections as key (key)}
  <AuthChannel {authStore} connKey={key} />
{/each}

<Dialog.Root bind:open>
  <Dialog.Trigger>
    <div>
      {#if allConfirmed}
        <Button
          class="h-fit w-full border border-green-500/50 bg-green-500/10 hover:bg-green-500/20"
        >
          <div class="h-fit w-full max-w-50 text-wrap wrap-break-word text-green-500">
            Все аккаунты подтверждены ✓
          </div>
        </Button>
      {:else}
        <Button class="h-fit w-full">
          <div class="flex h-fit w-full max-w-50 flex-wrap items-center justify-center gap-1.5">
            {#each unauthedKeys as key (key)}
              {@const conn = info(key)}
              {#if conn.server}
                <ServerIcon
                  server={conn.server}
                  channel={conn.channel}
                  status="connected"
                  class="auth-unauthed-icon h-5 w-5"
                />
              {/if}
            {/each}
            <span class="text-wrap wrap-break-word">
              Подтверди аккаунт для сохранения истории!
            </span>
          </div>
        </Button>
      {/if}
    </div>
  </Dialog.Trigger>
  <Dialog.Content class="bg-card2">
    <Dialog.Header class="text-xl">Подтверждение аккаунтов</Dialog.Header>
    <div class="">
      Скопируй код и отправь его в каждый чат, чтобы подтвердить владение и сохранять историю
    </div>
    {#if authStore.connections.length === 0}
      <div class="text-center text-muted-foreground">Нет подключённых чатов</div>
    {:else}
      {#if unauthedKeys.length > 0}
        <div class="flex flex-col gap-2">
          {#each unauthedKeys as key (key)}
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
              {#if conn.isChecking || conn.isConfirming}
                <span class="text-sm text-muted-foreground">Проверка…</span>
              {:else}
                <span class="text-sm font-semibold text-red-500">Не подтверждён</span>
              {/if}
            </div>
          {/each}
        </div>
        <div class="mt-3">
          {#if sharedKey}
            <Button class="h-fit w-full py-3 text-base whitespace-normal" onclick={copyCode}>
              {#if copied}
                Скопировано!
              {:else}
                <span class="inline-flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5">
                  <span>Скопировать</span>
                  <span class="font-mono leading-none font-bold">+мой {sharedKey}</span>
                </span>
              {/if}
            </Button>
          {:else if isBusy}
            <div class="rounded-xl border bg-card p-3 text-center text-sm text-muted-foreground">
              Генерация кода…
            </div>
          {:else}
            <div class="rounded-xl border bg-card p-3 text-center text-sm text-muted-foreground">
              —
            </div>
          {/if}
        </div>
      {/if}
      {#if authedKeys.length > 0}
        <div class="mt-3 flex flex-col gap-2">
          {#each authedKeys as key (key)}
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
              <span class="text-sm font-semibold text-green-500">Подтверждён</span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
    <div class="mt-4">
      <div>Как это работает:</div>
      <ol class="mt-3 ml-6 list-outside list-decimal space-y-1">
        <li>Скопируй код</li>
        <li>Отправь его в каждый неподтверждённый чат</li>
        <li>Система видит в чате что код отправлен именно владельцем канала</li>
        <li>Сессии пользователя становятся подтвержденными и сохраняется история</li>
      </ol>
    </div>
  </Dialog.Content>
</Dialog.Root>

<style>
  /* Class lands on the <img> inside ServerIcon (child component),
     so it must be global to apply. */
  :global(.auth-unauthed-icon) {
    filter: sepia(1) saturate(5) hue-rotate(-50deg) brightness(0.95)
      drop-shadow(0 0 5px rgba(239, 68, 68, 0.9));
  }
</style>

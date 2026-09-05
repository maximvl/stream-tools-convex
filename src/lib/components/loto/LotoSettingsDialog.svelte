<script lang="ts">
  import * as Dialog from '../ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { DefaultConfig, getLotoConfigStore, getLotoStore } from '$lib/stores/lotoStore.svelte'
  import { type VkRoleId } from '$lib/types'
  import { SuperGameIcons } from '$lib/constants'

  const configStore = getLotoConfigStore()
  let open = $state(false)

  const lotoStore = getLotoStore()

  function resetConfig() {
    configStore.value = DefaultConfig
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>
    <Button variant="outline" class="w-full">Настройки</Button>
  </Dialog.Trigger>
  <Dialog.Content class="bg-card2">
    <Dialog.Header>Настройки лото</Dialog.Header>
    <div class="flex max-h-[70vh] flex-col gap-8 overflow-y-auto pr-6">
      <div class="flex flex-col gap-4">
        <Button variant="destructive" class="w-full" onclick={resetConfig}
          >Сбросить настройки</Button
        >
        <div class="text-2xl font-semibold text-muted-foreground">Основные настройки</div>
        <div class="flex gap-2">
          <Label for="win-matches-amount" class="w-full"
            >Количество совпадений в билете для победы</Label
          >
          <Input
            id="win-matches-amount"
            type="number"
            bind:value={configStore.value.win_matches_amount}
            min="1"
            max="10"
          />
        </div>
        <div class="flex gap-2">
          <Label for="ticket-size" class="w-full">Размер билета</Label>
          <Input
            id="ticket-size"
            type="number"
            bind:value={configStore.value.ticket_size}
            min="1"
            max="10"
          />
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <div class="text-2xl font-semibold text-muted-foreground">Билеты</div>
        <div class="flex items-center gap-2">
          <Checkbox id="enable-chat-tickets" bind:checked={configStore.value.enable_chat_tickets} />
          <Label for="enable-chat-tickets" class="cursor-pointer">Билеты из чата</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox
            id="enable-points-tickets"
            bind:checked={configStore.value.enable_points_tickets}
          />
          <Label for="enable-points-tickets" class="cursor-pointer">Билеты за поинты</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox id="only-subscribers" bind:checked={configStore.value.only_subscribers} />
          <Label for="only-subscribers" class="cursor-pointer">Только подписчики</Label>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <div class="text-2xl font-semibold text-muted-foreground">Игра</div>
        <div class="flex items-center gap-2">
          <Checkbox id="manual-draw-enabled" bind:checked={configStore.value.manual_draw_enabled} />
          <Label for="manual-draw-enabled" class="cursor-pointer">Ручной ввод</Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox
            id="allow-mods-to-input-numbers"
            bind:checked={configStore.value.allow_mods_to_input_numbers}
          />
          <Label for="allow-mods-to-input-numbers" class="cursor-pointer">
            Модераторы могут вводить числа
          </Label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox
            id="allow-tickets-after-start"
            bind:checked={configStore.value.allow_tickets_after_start}
          />
          <Label for="allow-tickets-after-start" class="cursor-pointer">
            Добавлять билеты после старта
          </Label>
        </div>
        <div class="flex gap-2">
          <Label for="max-number" class="w-full">Максимальное число</Label>
          <Input
            id="max-number"
            type="number"
            bind:value={configStore.value.max_number}
            min="10"
            max="999"
          />
        </div>
        <div class="flex gap-2">
          <Label for="roll-animation-time" class="w-full">Время анимации ролла (мс)</Label>
          <Input
            id="roll-animation-time"
            type="number"
            bind:value={configStore.value.roll_animation_time}
            min="100"
            max="5000"
            step="100"
          />
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <div class="text-2xl font-semibold text-muted-foreground">Супер игра</div>
        <div class="rounded-xl bg-card p-2 text-center">
          Примерный шанс победы: {Math.round(lotoStore.superGameWinChance * 100)}%
        </div>
        <div class="flex items-center gap-2">
          <Checkbox
            id="super-game-bonus-guesses-enabled"
            bind:checked={configStore.value.super_game_bonus_guesses_enabled}
          />
          <Label for="super-game-bonus-guesses-enabled" class="cursor-pointer">
            Бонусные попытки за открытия
          </Label>
        </div>
        <div class="flex gap-2">
          <Label for="super-game-options-amount" class="w-full">Количество ячеек</Label>
          <Input
            id="super-game-options-amount"
            type="number"
            bind:value={configStore.value.super_game_options_amount}
            min="1"
            max="20"
          />
        </div>
        <div class="flex gap-2">
          <Label for="super-game-guesses-amount" class="w-full">Количество попыток</Label>
          <Input
            id="super-game-guesses-amount"
            type="number"
            bind:value={configStore.value.super_game_guesses_amount}
            min="1"
            max="10"
          />
        </div>
        <div class="flex gap-2">
          <Label for="super-game-win-score" class="w-full">Количество очков для победы</Label>
          <Input
            id="super-game-win-score"
            type="number"
            bind:value={configStore.value.super_game_win_score}
            min="1"
            max="100"
          />
        </div>
        <div class="flex gap-2">
          <div class="flex w-full items-center gap-2">
            <Label for="super-game-1-pointers" class="w-full">Ячеек за 1 очко</Label>
            <img src={SuperGameIcons['x1']} class="h-6 w-6" alt="x1" />
          </div>
          <Input
            id="super-game-1-pointers"
            type="number"
            bind:value={configStore.value.super_game_1_pointers}
            min="0"
            max="10"
          />
        </div>
        <div class="flex gap-2">
          <div class="flex w-full items-center gap-2">
            <Label for="super-game-2-pointers" class="w-full">Ячеек за 2 очка</Label>
            <img src={SuperGameIcons['x2']} class="h-6 w-6" alt="x2" />
          </div>
          <Input
            id="super-game-2-pointers"
            type="number"
            bind:value={configStore.value.super_game_2_pointers}
            min="0"
            max="10"
          />
        </div>
        <div class="flex gap-2">
          <div class="flex w-full items-center gap-2">
            <Label for="super-game-3-pointers" class="w-full">Ячеек за 3 очка</Label>
            <img src={SuperGameIcons['x3']} class="h-6 w-6" alt="x3" />
          </div>
          <Input
            id="super-game-3-pointers"
            type="number"
            bind:value={configStore.value.super_game_3_pointers}
            min="0"
            max="10"
          />
        </div>
        <div class="flex gap-2">
          <div class="flex w-full items-center gap-2">
            <Label for="super-game-bombs" class="w-full">Количество бомб (-1 очко)</Label>
            <img src={SuperGameIcons['bomb']} class="h-6 w-6" alt="bomb" />
          </div>
          <Input
            id="super-game-bombs"
            type="number"
            bind:value={configStore.value.super_game_bombs}
            min="0"
            max="10"
          />
        </div>
        <h4 class="font-semibold text-muted-foreground">Награды с VK</h4>
        <div>
          {#each Object.entries(lotoStore.vkRolesRewards) as [connection, rewards] (connection)}
            <div class="mb-4">{connection}</div>
            {#each rewards as reward (reward.id)}
              <div class="flex items-center gap-4">
                <Label class="w-fit">{reward.name}</Label>
                <img src={reward.largeUrl} alt={reward.name} class="h-6 w-6" />
                <Input
                  type="number"
                  class="max-w-50"
                  value={configStore.value.super_game_vk_rewards?.[connection]?.[reward.id] ?? 0}
                  onchange={(e) => {
                    if (!configStore.value.super_game_vk_rewards) {
                      configStore.value.super_game_vk_rewards = {}
                    }
                    if (!configStore.value.super_game_vk_rewards[connection]) {
                      configStore.value.super_game_vk_rewards[connection] = {}
                    }
                    configStore.value.super_game_vk_rewards[connection][reward.id as VkRoleId] =
                      Number(e.currentTarget.value)
                  }}
                  min="0"
                  max="100"
                />
              </div>
            {/each}
          {/each}
        </div>
        <div class="mb-10"></div>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>

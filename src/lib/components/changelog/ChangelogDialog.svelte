<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { ScrollTextIcon } from '@lucide/svelte'
  import { LocalStore } from '$lib/stores/localStore.svelte'
  import { onMount } from 'svelte'

  type ChangelogEntry = {
    version: string
    date: string
    changes: string[]
  }

  const seenVersion = new LocalStore<string>('lastSeenVersion', '')
  let open = $state(false)

  onMount(() => {
    const latest = changelog[0]?.version ?? ''
    if (latest && latest !== seenVersion.value) {
      open = true
      seenVersion.value = latest
    }
  })

  const changelog: ChangelogEntry[] = [
    {
      version: '1.39',
      date: '2026-08-31',
      changes: ['Пофикшено подтверждение аккаунтов на нескольких платформах'],
    },
    {
      version: '1.38',
      date: '2026-08-29',
      changes: [
        'Пофикшено: победитель лото больше не теряет статус победителя при отправке сообщения со словом «лото»',
        'Добавлена проверка владения каналом для сохранения истории',
      ],
    },
    {
      version: '1.37',
      date: '2026-08-26',
      changes: ['Добавлена интеграция с w.tv'],
    },
    {
      version: '1.36',
      date: '2026-03-19',
      changes: [
        'Добавлена покупка доп билета лото на Твиче через подсвеченное сообещение',
        'Улучшена стабильность соединения с Твичем',
      ],
    },
    {
      version: '1.35',
      date: '2025-08-02',
      changes: ['Пофикшен баг с несколькими участниками супер-игры'],
    },
    {
      version: '1.34',
      date: '2025-07-03',
      changes: [
        'Добавлена возможность делегировать ручной ввод бочонков модераторам',
        'Добавлено отображение участников с каждого сервера',
      ],
    },
    {
      version: '1.33',
      date: '2025-07-03',
      changes: [
        'Улучшено переподключение к чатам',
        'Добавлена опция ограничения бочонков до 90 (как в реальном лото)',
        'Добавлена возможность реролить билет пока не начался розыгрыш',
      ],
    },
    {
      version: '1.32',
      date: '2025-06-25',
      changes: [
        'Улучшена сортировка билетов: теперь первыми будут билеты с наибольшим шансом на победу, а не те у которых больше общее количество совпадений',
        'Добавлено выделение последнего бочонока в билетах',
      ],
    },
    {
      version: '1.31',
      date: '2025-06-22',
      changes: [
        'Добавлена настройка ручного ввода бочонков',
        'Добавлена возможность менять настройки по ходу игры',
      ],
    },
    {
      version: '1.30',
      date: '2025-05-27',
      changes: [
        'Теперь можно получать билеты во время розыгрыша (билет не будет иметь выпавшие бочонки)',
        'Билеты хоста лото отображаются отдельно',
        'Улучшены цвета фона билетов',
        'Показывается время получения билета когда несколько собрали выигрышную комбинацию',
      ],
    },
    {
      version: '1.29',
      date: '2025-05-13',
      changes: ['Добавлена интеграция с YouTube'],
    },
    {
      version: '1.28',
      date: '2025-05-09',
      changes: ['Пофикшено сохранение статуса супер игры'],
    },
    {
      version: '1.27',
      date: '2025-05-04',
      changes: ['Пофикшено соединение с GoodGame'],
    },
    {
      version: '1.26',
      date: '2025-05-03',
      changes: ['Добавлена интеграция с Kick'],
    },
    {
      version: '1.25',
      date: '2025-04-28',
      changes: [
        'Добавлена возможность розыгрывать награды стрима в супер игре лото (пока только на vkvideo)',
      ],
    },
    {
      version: '1.24',
      date: '2025-04-21',
      changes: ['Пофикшен баг с возможностью получать в билете больше чисел чем положено'],
    },
    {
      version: '1.23',
      date: '2025-03-29',
      changes: [
        'Добавлена настройка времени доставания бочонков',
        'Пофикшено сохранение победителей',
      ],
    },
    {
      version: '1.22',
      date: '2025-03-25',
      changes: ['Улучшен статус подключения к чатам'],
    },
    {
      version: '1.21',
      date: '2025-03-21',
      changes: ['Добавлена полная конфигурация лото и супер игры'],
    },
    {
      version: '1.20',
      date: '2025-03-20',
      changes: [
        'Добавлена возможность удаления победителя и продолжения лото',
        'Улучшено отображение таймера',
      ],
    },
    {
      version: '1.19',
      date: '2025-03-18',
      changes: ['В лото теперь может быть только один победитель'],
    },
    {
      version: '1.18',
      date: '2025-03-14',
      changes: ['Добавлена возможность подключать несколько чатов'],
    },
    {
      version: '1.17',
      date: '2025-02-15',
      changes: ['Добавлено сохранение победителей лото'],
    },
    {
      version: '1.16',
      date: '2025-02-11',
      changes: ['Улучшено отображение супер игры'],
    },
    {
      version: '1.15',
      date: '2025-02-02',
      changes: ['Полностью переделана супер игра лото'],
    },
    {
      version: '1.14',
      date: '2025-01-12',
      changes: [
        'Улучшено отображение билетов',
        'Улучшено отображение супер игры',
        'Добавлен таймер',
      ],
    },
    {
      version: '1.13',
      date: '2025-01-10',
      changes: ['Улучшена интеграция с чатом твича', 'Добавлена интеграция с nuum и goodgame'],
    },
    {
      version: '1.12',
      date: '2024-12-25',
      changes: ['Добавлена интеграция с чатом твича'],
    },
    {
      version: '1.11',
      date: '2024-10-01',
      changes: ['Добавлено лото'],
    },
    {
      version: '1.10',
      date: '2024-08-24',
      changes: [
        'Добавлен новый раунд: Счастливый билетик',
        'Все бонусные раунды теперь могут появляться только один раз',
        'Обновлен интерфейс',
      ],
    },
    {
      version: '1.9',
      date: '2024-08-10',
      changes: ['Добавлен новый раунд: Воскрешение'],
    },
    {
      version: '1.8',
      date: '2024-06-30',
      changes: ['Добавлен новый раунд: Стример против Чата'],
    },
    {
      version: '1.7',
      date: '2024-06-22',
      changes: ['Добавлена отдельная страница голосования'],
    },
    {
      version: '1.6',
      date: '2024-06-21',
      changes: ['Добавлен новый раунд: Подмена'],
    },
    {
      version: '1.5',
      date: '2024-06-20',
      changes: ['Улучшена плавность колеса рандома, добавлен шанс возврата'],
    },
    {
      version: '1.4',
      date: '2024-06-19',
      changes: ['Улучшено отображение инструкций голосования'],
    },
    {
      version: '1.3',
      date: '2024-05-21',
      changes: ['Бекенд полностью переписан с Python на Crystal'],
    },
    {
      version: '1.2',
      date: '2024-05-14',
      changes: ['Добавлено сохранение пресетов'],
    },
    {
      version: '1.1',
      date: '2024-05-07',
      changes: [
        'Пофикшен редкий краш голосования чата',
        'Выровнен уровень громкости музыки',
        'Добавлен слайдер громкости',
        'Улучшена автопрокрутка лога голосования',
      ],
    },
    {
      version: '1.0',
      date: '2024-05-01',
      changes: [
        'Темная тема по-умолчанию',
        'Добавлено колесо рандома',
        'Добавлена музыка для разных раундов',
        'Улучшено голосование зрителей',
        'Новый экран победы',
      ],
    },
  ]
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger
    aria-label="Что нового"
    class="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
  >
    <ScrollTextIcon />
  </Dialog.Trigger>
  <Dialog.Content class="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title class="text-2xl">Что нового</Dialog.Title>
    </Dialog.Header>
    <div class="relative mt-6 pl-6">
      {#each changelog as entry (entry.version)}
        <div class="relative mb-8 last:mb-0">
          <div class="mb-2 flex flex-wrap items-center gap-3">
            <span class="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">
              v{entry.version}
            </span>
            <time class="text-muted-foreground">{entry.date}</time>
          </div>
          <ul class="space-y-1.5">
            {#each entry.changes as change (change)}
              <li class="flex items-start gap-2 text-lg text-foreground/90">
                <span class="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true"
                ></span>
                <span>{change}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  </Dialog.Content>
</Dialog.Root>

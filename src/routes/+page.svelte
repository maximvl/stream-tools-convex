<script lang="ts">
  import ConnectionDialog from '$lib/components/connections/ConnectionDialog.svelte'
  import Nav from '$lib/components/layout/Nav.svelte'
  import { HourglassIcon } from '@lucide/svelte'
</script>

<div class="dark flex min-h-screen flex-col items-center p-8">
  <Nav />

  <div class="mb-12 flex w-full max-w-6xl items-center">
    <div class="w-[250px]">
      <ConnectionDialog />
    </div>
    <div class="flex-1 text-center">
      <h1 class="text-4xl font-extrabold tracking-tight">Stream Tools</h1>
    </div>
    <div class="w-[250px]"></div>
  </div>

  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
    <a
      href="/loto"
      class="group flex flex-col gap-4 rounded-3xl border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-ticket"
        >
          <path
            d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"
          />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>
      <div>
        <h2 class="text-xl font-bold">Лото</h2>
        <p class="text-sm text-muted-foreground">Стример проводит лото для зрителей</p>
      </div>
    </a>

    <a
      href="/turnir"
      class="group flex flex-col gap-4 rounded-3xl border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-trophy"
        >
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 22V18" />
          <path d="M14 22V18" />
          <path d="M18 4H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
          <path d="M12 11V18" />
        </svg>
      </div>
      <div>
        <h2 class="text-xl font-bold">Турнир</h2>
        <p class="text-sm text-muted-foreground">
          Стример и зрители проводят турнир из множества вариантов где победит только один
        </p>
      </div>
    </a>

    <a
      href="/word"
      class="group flex flex-col gap-4 rounded-3xl border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="lucide lucide-type"
        >
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" x2="15" y1="20" y2="20" />
          <line x1="12" x2="12" y1="4" y2="20" />
        </svg>
      </div>
      <div>
        <h2 class="text-xl font-bold">Угадай слово</h2>
        <p class="text-sm text-muted-foreground">
          Игра, в которой зрители должны угадать загаданное вами слово
        </p>
      </div>
    </a>
    <a
      href="/whenis"
      class="group flex flex-col gap-4 rounded-3xl border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <HourglassIcon />
      </div>
      <div>
        <h2 class="text-xl font-bold">Таймеры ивентов</h2>
        <p class="text-sm text-muted-foreground">Таймеры предстоящих событий и релизов</p>
      </div>
    </a>

    <a
      href="/vote"
      class="group flex flex-col gap-4 rounded-3xl border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 20V10" />
          <path d="M18 20V4" />
          <path d="M6 20v-4" />
        </svg>
      </div>
      <div>
        <h2 class="text-xl font-bold">Голосование</h2>
        <p class="text-sm text-muted-foreground">
          Проводите опросы в реальном времени по сообщениям из чата
        </p>
      </div>
    </a>

    <a
      href="/game"
      class="group flex flex-col gap-4 rounded-3xl border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 11h10" />
          <path d="M8 11V7a4 4 0 1 1 8 0v4" />
          <path d="M12 15v6" />
          <path d="M9 18h6" />
        </svg>
      </div>
      <div>
        <h2 class="text-xl font-bold">Hex Поле</h2>
        <p class="text-sm text-muted-foreground">Battle Royale со зрителями пишут</p>
      </div>
    </a>
  </div>
</div>

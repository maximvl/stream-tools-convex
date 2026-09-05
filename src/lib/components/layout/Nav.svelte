<script lang="ts">
  import { page } from '$app/state'
  import ChangelogDialog from '$lib/components/changelog/ChangelogDialog.svelte'
</script>

<nav class="bg-card2 mb-8 flex items-center rounded-xl px-4 py-2 text-xl">
  <ul class="flex items-center gap-6 font-medium">
    <li>
      <a
        href="/"
        class="transition-opacity hover:opacity-100 {page.url.pathname === '/'
          ? 'text-primary'
          : 'opacity-60'}"
      >
        Главная
      </a>
    </li>
    <li>
      <a
        href="/loto"
        class="transition-opacity hover:opacity-100 {page.url.pathname.startsWith('/loto')
          ? 'text-primary'
          : 'opacity-60'}"
      >
        Лото
      </a>
    </li>
    <li>
      <a
        href="/vote"
        class="transition-opacity hover:opacity-100 {page.url.pathname.startsWith('/vote')
          ? 'text-primary'
          : 'opacity-60'}"
      >
        Голосование
      </a>
    </li>
    <li>
      <a
        href="/whenis"
        class="transition-opacity hover:opacity-100 {page.url.pathname.startsWith('/whenis')
          ? 'text-primary'
          : 'opacity-60'}"
      >
        Ивенты
      </a>
    </li>
    <li>
      <a
        href="/turnir"
        class="transition-opacity hover:opacity-100 {page.url.pathname.startsWith('/turnir')
          ? 'text-primary'
          : 'opacity-60'}"
      >
        Турнир
      </a>
    </li>
    <li>
      <a
        href="/word"
        class="transition-opacity hover:opacity-100 {page.url.pathname.startsWith('/word')
          ? 'text-primary'
          : 'opacity-60'}"
      >
        Угадай слово
      </a>
    </li>
    <li>
      <a
        href="/game"
        class="transition-opacity hover:opacity-100 {page.url.pathname.startsWith('/game')
          ? 'text-primary'
          : 'opacity-60'}"
      >
        Игра
      </a>
    </li>
    <li class="flex items-center">
      <ChangelogDialog />
    </li>
  </ul>
</nav>

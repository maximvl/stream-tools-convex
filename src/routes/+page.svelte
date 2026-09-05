<script lang="ts">
  import ConnectionDialog from '$lib/components/connections/ConnectionDialog.svelte'
  import Nav from '$lib/components/layout/Nav.svelte'
</script>

<div class="dark flex min-h-screen flex-col items-center p-8">
  <Nav />

  <div class="mb-12 flex w-full max-w-6xl items-center">
    <div class="w-[250px]">
      <ConnectionDialog />
    </div>
    <div class="flex-1 text-center">
      <h1 class="text-4xl font-extrabold tracking-tight">Convex App</h1>
    </div>
    <div class="w-[250px]"></div>
  </div>

  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
    <a
      href="/loto"
      class="group flex flex-col gap-4 rounded-3xl border bg-card p-8 transition-all hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10"
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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
  </div>
</div>

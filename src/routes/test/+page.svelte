<script lang="ts">
  import ConnectionDialog from '$lib/components/connections/ConnectionDialog.svelte'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
  import Nav from '$lib/components/layout/Nav.svelte'
  import { LocalStore } from '$lib/stores/localStore.svelte'

  const textStore = new LocalStore('test:text', 'default text')
  const numberStore = new LocalStore('test:number', 42)
  const rangeStore = new LocalStore('test:number', 50)
  const selectStore = new LocalStore('test:select', 'option1')
  const checkboxStore = new LocalStore('test:checkbox', false)
  const textareaStore = new LocalStore('test:text', '')

  // let rangeValue = $state(String(numberStore.value))

  // $effect(() => {
  //   rangeValue = String(numberStore.value)
  // })

  // $effect(() => {
  //   numberStore.value = Number(rangeValue)
  // })

  function resetAll() {
    textStore.value = 'default text'
    numberStore.value = 42
    selectStore.value = 'option1'
    checkboxStore.value = false
    textareaStore.value = ''
  }
</script>

<div class="dark flex min-h-screen flex-col items-center p-8">
  <Nav />

  <div class="mb-12 flex w-full max-w-6xl items-center">
    <div class="w-[250px]">
      <ConnectionDialog />
    </div>
    <div class="flex-1 text-center">
      <h1 class="text-4xl font-extrabold tracking-tight">Test Features</h1>
    </div>
    <div class="flex w-[250px] justify-end">
      <Button variant="outline" onclick={resetAll}>Reset All</Button>
    </div>
  </div>

  <div class="flex w-full max-w-2xl flex-col gap-8">
    <div class="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
      <h2 class="text-lg font-semibold">Text Input</h2>
      <Input type="text" placeholder="Enter text..." bind:value={textStore.value} />
      <p class="text-sm text-muted-foreground">Value: {textStore.value}</p>
    </div>

    <div class="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
      <h2 class="text-lg font-semibold">Textarea</h2>
      <textarea
        class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        placeholder="Enter multi-line text..."
        bind:value={textareaStore.value}
      ></textarea>
      <p class="text-sm text-muted-foreground">Value: {textareaStore.value}</p>
    </div>

    <div class="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
      <h2 class="text-lg font-semibold">Number Input</h2>
      <Input type="number" placeholder="Enter number..." bind:value={numberStore.value} />
      <p class="text-sm text-muted-foreground">Value: {numberStore.value}</p>
    </div>

    <div class="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
      <h2 class="text-lg font-semibold">Range Slider</h2>
      <Input type="range" min="0" max="100" class="w-full" bind:value={rangeStore.value} />
      <p class="text-sm text-muted-foreground">Value: {rangeStore.value}</p>
    </div>

    <div class="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
      <h2 class="text-lg font-semibold">Select Dropdown</h2>
      <select
        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        bind:value={selectStore.value}
      >
        <option value="option1">Option 1</option>
        <option value="option2">Option 2</option>
        <option value="option3">Option 3</option>
      </select>
      <p class="text-sm text-muted-foreground">Value: {selectStore.value}</p>
    </div>

    <div class="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
      <h2 class="text-lg font-semibold">Checkbox</h2>
      <label class="flex items-center gap-2">
        <input type="checkbox" bind:checked={checkboxStore.value} />
        <span class="text-sm">Enable feature</span>
      </label>
      <p class="text-sm text-muted-foreground">Value: {checkboxStore.value}</p>
    </div>
  </div>
</div>

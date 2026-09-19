import { createContext } from 'svelte'
import {
  createItem,
  ClassicRoundTypes,
  RoundTypes,
  type Item,
  type RoundType,
  type TurnirState,
} from '$lib/turnir/types'
import { LocalStore } from './localStore.svelte'

const INITIAL_ITEMS = 10
const ADD_MORE_ITEMS = 10

export type TurnirSettings = {
  noRoundRepeat: boolean
  subscriberOnly: boolean
  roundTypes: Record<RoundType, boolean>
}

export function defaultTurnirSettings(): TurnirSettings {
  return {
    noRoundRepeat: true,
    subscriberOnly: false,
    roundTypes: {
      RandomElimination: true,
      StreamerChoice: true,
      ViewerChoice: true,
      Protection: false,
      StreamerVsRandom: false,
      Swap: false,
      ClosestVotes: false,
      Resurrection: false,
      Deal: false,
      DealReturn: false,
    },
  }
}

export function getTurnirSettingsStore() {
  const store = new LocalStore<TurnirSettings>('turnir-settings', defaultTurnirSettings())
  const defaults = defaultTurnirSettings()
  const patched: TurnirSettings = {
    noRoundRepeat: store.value.noRoundRepeat ?? defaults.noRoundRepeat,
    subscriberOnly: store.value.subscriberOnly ?? defaults.subscriberOnly,
    roundTypes: { ...defaults.roundTypes, ...store.value.roundTypes },
  }
  if (
    patched.noRoundRepeat !== store.value.noRoundRepeat ||
    patched.subscriberOnly !== store.value.subscriberOnly ||
    RoundTypes.some((round) => patched.roundTypes[round] !== store.value.roundTypes?.[round])
  ) {
    store.value = patched
  }
  return store
}

function pickRandom<T>(options: T[]): T | undefined {
  if (options.length === 0) return undefined
  return options[Math.floor(Math.random() * options.length)]
}

/**
 * Reactive port of TournirPage.tsx `TournirApp()` state machine (MVP: classic rounds only).
 *
 * Refactor notes vs React:
 * - No `useEffect` transition loop on `[turnirState, items]`. Transitions are explicit:
 *   `startTurnir()` / `eliminateItem()` / `skipRound()` synchronously advance
 *   `roundNumber` / `roundId` / `currentRoundType` / `turnirState`.
 * - This also fixes a React quirk where `onItemElimination` incremented `roundNumber`
 *   and the `RoundChange` effect incremented it again (numbers skipped by 2).
 *   Here each completed round increments `roundNumber` exactly once.
 * - Derived lists (`nonEmptyItems`, `activeItems`, ...) are `$derived`, so UI
 *   never holds a stale copy the way React's closure-captured `activeItems` did.
 */
export class TurnirStore {
  items = $state<Item[]>(Array.from({ length: INITIAL_ITEMS }, (_, i) => createItem(String(i + 1))))
  turnirState = $state<TurnirState>('EditCandidates')
  roundNumber = $state(0)
  roundId = $state(0)
  currentRoundType = $state<RoundType | null>(null)
  settings = getTurnirSettingsStore()
  lastNonBonusRoundType = $state<RoundType | null>(null)

  get noRoundRepeat() {
    return this.settings.value.noRoundRepeat
  }

  set noRoundRepeat(value: boolean) {
    this.settings.value.noRoundRepeat = value
  }

  get subscriberOnly() {
    return this.settings.value.subscriberOnly
  }

  set subscriberOnly(value: boolean) {
    this.settings.value.subscriberOnly = value
  }

  // --- derived ---

  nonEmptyItems = $derived.by(() => this.items.filter((item) => item.title.trim() !== ''))
  activeItems = $derived.by(() => this.nonEmptyItems.filter((item) => item.status === 'Active'))
  eliminatedItems = $derived.by(() =>
    this.nonEmptyItems.filter((item) => item.status === 'Eliminated'),
  )
  activeRounds = $derived.by(() =>
    ClassicRoundTypes.filter((round) => this.settings.value.roundTypes[round]),
  )
  canEditItems = $derived(this.turnirState === 'EditCandidates')
  isRoundActive = $derived(this.turnirState === 'RoundStart' && this.currentRoundType !== null)
  totalRounds = $derived(Math.max(0, this.nonEmptyItems.length - 1))
  winner = $derived.by(() => (this.turnirState === 'Victory' ? this.activeItems[0] : undefined))

  // --- edit phase ---

  setItemTitle(index: number, text: string) {
    const item = this.items[index]
    if (item) item.title = text
  }

  /** Paste handler parity with React ItemsList: fills starting at `index`. */
  pasteItems(index: number, lines: string[]) {
    lines.forEach((line, offset) => {
      const item = this.items[index + offset]
      if (item) item.title = line
    })
  }

  addMoreItems(count = ADD_MORE_ITEMS) {
    const nextIndex = this.items.length
    for (let i = 0; i < count; i++) {
      this.items.push(createItem(String(nextIndex + i + 1)))
    }
  }

  toggleRoundType(round: RoundType) {
    this.settings.value.roundTypes[round] = !this.settings.value.roundTypes[round]
  }

  resetSettings() {
    this.settings.value = defaultTurnirSettings()
  }

  // --- tournament flow ---

  startTurnir() {
    if (this.nonEmptyItems.length === 0 || this.activeRounds.length === 0) return
    for (const item of this.nonEmptyItems) {
      item.status = 'Active'
      item.eliminationRound = undefined
      item.eliminationType = undefined
      item.isProtected = false
      item.swappedWith = undefined
      item.isResurrected = false
      item.hasDeal = false
    }
    // Drop empties so ids stay stable during play (matches React `setItems([...nonEmptyItems])`).
    this.items = [...this.nonEmptyItems]
    this.roundNumber = 1
    this.roundId = 0
    this.lastNonBonusRoundType = null
    this.startNextRound()
  }

  /** MVP elimination: no protection/swap guards (those arrive with bonus rounds). */
  eliminateItem(id: string) {
    if (!this.isRoundActive || !this.currentRoundType) return
    const item = this.activeItems.find((item) => item.id === id)
    if (!item) return
    item.status = 'Eliminated'
    item.eliminationRound = this.roundNumber
    item.eliminationType = this.currentRoundType
    this.advanceAfterChange()
  }

  /** Skip button / SkipRoundModal confirm: advance without eliminating. */
  skipRound() {
    if (!this.isRoundActive) return
    this.advanceAfterChange()
  }

  restartToEdit() {
    this.turnirState = 'EditCandidates'
    this.currentRoundType = null
  }

  private advanceAfterChange() {
    if (this.activeItems.length <= 1) {
      this.turnirState = 'Victory'
      return
    }
    this.roundNumber += 1
    this.startNextRound()
  }

  private startNextRound() {
    const next = this.pickNextRoundType()
    if (!next) return
    this.lastNonBonusRoundType = next
    this.currentRoundType = next
    this.roundId += 1
    this.turnirState = 'RoundStart'
  }

  private pickNextRoundType(): RoundType | undefined {
    let options = [...this.activeRounds]
    if (this.noRoundRepeat && options.length > 1 && this.lastNonBonusRoundType) {
      options = options.filter((round) => round !== this.lastNonBonusRoundType)
    }
    return pickRandom(options)
  }
}

export const [getTurnirStore, setTurnirStore] = createContext<TurnirStore>()

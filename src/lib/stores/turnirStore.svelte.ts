import { createContext } from 'svelte'
import {
  createItem,
  ClassicRoundTypes,
  ImplementedBonusRounds,
  OneTimeRounds,
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
      Protection: true,
      StreamerVsRandom: true,
      Swap: true,
      ClosestVotes: true,
      Resurrection: true,
      Deal: true,
      DealReturn: true,
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
 * Reactive port of TournirPage.tsx `TournirApp()` state machine
 * (classic rounds + Protection/Swap bonus rounds).
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
  usedOneTimeRounds = $state<RoundType[]>([])
  showProtectionModal = $state(false)
  showSwapModal = $state(false)
  protectionRevealItemId = $state<string | null>(null)
  swapReveal = $state<{ initialId: string; actionId: string } | null>(null)

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
  dealItem = $derived.by(() => this.nonEmptyItems.find((item) => item.status === 'Excluded'))
  activeRounds = $derived.by(() =>
    [...ClassicRoundTypes, ...ImplementedBonusRounds].filter(
      (round) => this.settings.value.roundTypes[round],
    ),
  )
  swapItem = $derived.by(() => this.activeItems.find((item) => item.swappedWith !== undefined))
  targetSwapItem = $derived.by(() => {
    const swap = this.swapItem
    return swap ? this.activeItems.find((item) => item.id === swap.swappedWith) : undefined
  })
  protectionRevealItem = $derived.by(() =>
    this.protectionRevealItemId
      ? (this.activeItems.find((item) => item.id === this.protectionRevealItemId) ?? undefined)
      : undefined,
  )
  swapRevealItems = $derived.by(() => {
    if (!this.swapReveal) return undefined
    const initial = this.activeItems.find((item) => item.id === this.swapReveal?.initialId)
    const action = this.activeItems.find((item) => item.id === this.swapReveal?.actionId)
    return initial && action ? { initial, action } : undefined
  })
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
    this.usedOneTimeRounds = []
    this.showProtectionModal = false
    this.showSwapModal = false
    this.protectionRevealItemId = null
    this.swapReveal = null
    this.startNextRound()
  }

  eliminateItem(id: string) {
    if (!this.isRoundActive || !this.currentRoundType) return
    const deal = this.dealItem
    if (deal && deal.id === id) {
      this.eliminateNow(deal)
      return
    }
    const item = this.activeItems.find((item) => item.id === id)
    if (!item) return
    if (item.isProtected) {
      this.protectionRevealItemId = item.id
      this.showProtectionModal = true
      return
    }
    const swap = this.swapItem
    const target = this.targetSwapItem
    if (item.swappedWith && target) {
      this.swapReveal = { initialId: item.id, actionId: target.id }
      this.showSwapModal = true
      return
    }
    if (target && swap?.swappedWith && item.id === target.id) {
      this.swapReveal = { initialId: item.id, actionId: swap.id }
      this.showSwapModal = true
      return
    }
    this.eliminateNow(item)
  }

  private eliminateNow(item: Item) {
    if (!this.currentRoundType) return
    item.status = 'Eliminated'
    item.eliminationRound = this.roundNumber
    item.eliminationType = this.currentRoundType
    this.advanceAfterChange()
  }

  /** Protection round wheel winner gets one-time protection. */
  protectItem(id: string) {
    if (!this.isRoundActive) return
    const item = this.activeItems.find((item) => item.id === id)
    if (!item) return
    item.isProtected = true
    this.advanceAfterChange()
  }

  /** Resurrected item returns to play (keeps its id, flags reset except resurrected). */
  resurrectItem(id: string) {
    if (!this.isRoundActive) return
    const item = this.eliminatedItems.find((item) => item.id === id)
    if (!item) return
    item.isResurrected = true
    item.status = 'Active'
    item.eliminationRound = undefined
    item.eliminationType = undefined
    this.advanceAfterChange()
  }

  /** Swap round wheel winner secretly swaps with a random other item. */
  applySwap(id: string) {
    if (!this.isRoundActive) return
    const item = this.activeItems.find((item) => item.id === id)
    if (!item) return
    const target = pickRandom(this.activeItems.filter((i) => i.id !== id))
    if (!target) return
    item.swappedWith = target.id
    this.advanceAfterChange()
  }

  /** Deal round pick: item sits out with a lucky ticket until DealReturn. */
  applyDeal(id: string) {
    if (!this.isRoundActive) return
    const item = this.activeItems.find((item) => item.id === id)
    if (!item) return
    item.hasDeal = true
    item.status = 'Excluded'
    this.advanceAfterChange()
  }

  /** DealReturn win: the deal item comes back into play. */
  returnDealItem() {
    if (!this.isRoundActive) return
    const deal = this.dealItem
    if (!deal) return
    deal.status = 'Active'
    deal.eliminationRound = undefined
    deal.eliminationType = undefined
    this.advanceAfterChange()
  }

  /** ProtectionRemoveModal confirm: protection is consumed, no elimination. */
  resolveProtectionReveal() {
    const item = this.protectionRevealItem
    this.showProtectionModal = false
    this.protectionRevealItemId = null
    if (!item) return
    item.isProtected = false
    this.advanceAfterChange()
  }

  /** SwapRevealModal confirm: swap links cleared, the real target is eliminated. */
  resolveSwapReveal() {
    const reveal = this.swapRevealItems
    this.showSwapModal = false
    this.swapReveal = null
    if (!reveal) return
    reveal.initial.swappedWith = undefined
    reveal.action.swappedWith = undefined
    // May chain into the protection modal if the real target is protected.
    this.eliminateItem(reveal.action.id)
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
    if (!OneTimeRounds.includes(next)) {
      this.lastNonBonusRoundType = next
    } else {
      this.usedOneTimeRounds = [...this.usedOneTimeRounds, next]
    }
    this.currentRoundType = next
    this.roundId += 1
    this.turnirState = 'RoundStart'
  }

  private pickNextRoundType(): RoundType | undefined {
    // DealReturn has no settings toggle: like the original, it is always in the
    // pool until used once, then removed with the other one-time rounds.
    let options: RoundType[] = [...this.activeRounds, 'DealReturn']
    if (this.nonEmptyItems.length < 6) {
      options = options.filter((round) => round !== 'Deal')
    }
    options = options.filter((round) => !this.usedOneTimeRounds.includes(round))
    if (this.noRoundRepeat && options.length > 1 && this.lastNonBonusRoundType) {
      options = options.filter((round) => round !== this.lastNonBonusRoundType)
    }
    const resurrectionEnabled = options.includes('Resurrection')
    const dealEnabled = options.includes('Deal')
    const dealReturnEnabled = options.includes('DealReturn')
    const deal = this.dealItem
    // The deal item pays for its ticket once eliminations catch up (or the
    // tournament is down to 2), unless Resurrection is about to fire instead.
    if (
      !resurrectionEnabled &&
      deal &&
      dealReturnEnabled &&
      (this.eliminatedItems.length >= this.activeItems.length || this.activeItems.length <= 2)
    ) {
      options = ['DealReturn']
    } else {
      options = options.filter((round) => round !== 'DealReturn')
    }
    // Mid-tournament comeback: once at least half the items are out,
    // force the Resurrection round (if enabled and unused).
    if (resurrectionEnabled && this.eliminatedItems.length >= this.activeItems.length) {
      options = ['Resurrection']
    } else {
      options = options.filter((round) => round !== 'Resurrection')
    }
    // Deal takes priority over everything when enabled and unused.
    if (dealEnabled) {
      options = ['Deal']
    } else {
      options = options.filter((round) => round !== 'Deal')
    }
    return pickRandom(options)
  }
}

export const [getTurnirStore, setTurnirStore] = createContext<TurnirStore>()

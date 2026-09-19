export type Item = {
  title: string
  status: ItemStatus
  eliminationRound?: number
  eliminationType?: RoundType
  swappedWith?: string
  isProtected?: boolean
  isResurrected?: boolean
  hasDeal?: boolean
  id: string
}

export type ItemStatus = 'Active' | 'Eliminated' | 'Excluded'

export type TurnirState = 'EditCandidates' | 'Start' | 'RoundStart' | 'RoundChange' | 'Victory'

export type RoundType =
  | 'RandomElimination'
  | 'StreamerChoice'
  | 'ViewerChoice'
  | 'Protection'
  | 'StreamerVsRandom'
  | 'Swap'
  | 'ClosestVotes'
  | 'Resurrection'
  | 'Deal'
  | 'DealReturn'

export const ClassicRoundTypes: RoundType[] = [
  'RandomElimination',
  'StreamerChoice',
  'ViewerChoice',
]

/** Bonus rounds currently implemented in Svelte. */
export const ImplementedBonusRounds: RoundType[] = [
  'Protection',
  'Swap',
  'ClosestVotes',
  'Resurrection',
  'Deal',
]

export const OneTimeRounds: RoundType[] = [
  'Protection',
  'Swap',
  'Resurrection',
  'Deal',
  'DealReturn',
]

export const NewRoundTypes: RoundType[] = [
  'Protection',
  'Swap',
  'ClosestVotes',
  'Resurrection',
  'Deal',
]

export const RoundTypes: RoundType[] = [...ClassicRoundTypes, ...NewRoundTypes]

export const RoundTypeNames: Record<RoundType, string> = {
  RandomElimination: 'Случайное устранение',
  StreamerChoice: 'Выбор стримера',
  ViewerChoice: 'Выбор зрителей',
  Protection: 'Защитный',
  StreamerVsRandom: 'Стример против рандома',
  Swap: 'Подмена',
  ClosestVotes: 'Стример против Чата',
  Resurrection: 'Воскрешение',
  Deal: '"Счастливый" билетик',
  DealReturn: 'Плата за билет',
}

export const RoundTypeTooltip: Partial<Record<RoundType, string>> = {
  RandomElimination: 'Выбывает случайный вариант',
  StreamerChoice: 'Стример выбирает кто вылетит',
  ViewerChoice: 'Зрители выбирают кто вылетит',
  Protection: 'Один раз за турнир случайный вариант получает разовую защиту от вылета',
  StreamerVsRandom: 'Стример выбирает кто вылетит не видя варианты',
  Swap: 'Случайный вариант скрытно меняется с другим, подмена вскроется когда один из них вылетит',
  ClosestVotes:
    'Вылетает вариант получивший наиболее близкое количество голосов к тому что выбрал стример',
  Resurrection: 'На середине турнира выбывший вариант получает возможность вернуться в игру',
  Deal: 'Выбранный вариант пропускает половину турнира, но будет ролить 50/50 чтобы вернуться',
}

export function createItem(id: string, title = ''): Item {
  return {
    id,
    title,
    status: 'Active',
    isProtected: false,
    swappedWith: undefined,
    isResurrected: false,
    hasDeal: false,
  }
}

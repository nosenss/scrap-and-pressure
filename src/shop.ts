import type { MetaState } from './types'

export type ShopItem = {
  id: string
  title: string
  desc: string
  cost: number
  type: 'expansion' | 'unlock' | 'multiplier' | 'utility'
  owned: (m: MetaState) => boolean
  canBuy: (m: MetaState) => boolean
  apply: (m: MetaState) => void
}

export function gridCost(size: number): number {
  const map: Record<number, number> = { 5: 80, 6: 140, 7: 220, 8: 320 }
  return map[size] ?? 9999
}

/** Real roguelike draft upgrades — no cash stubs. */
export const UPGRADE_POOL: ShopItem[] = [
  {
    id: 'expand_chamber',
    title: 'Chamber Expansion',
    desc: '+1 row & column. Fits larger scrap layouts.',
    type: 'expansion',
    cost: 0,
    owned: (m) => m.gridSize >= 9,
    canBuy: (m) => m.gridSize < 9,
    apply: (m) => {
      m.gridSize += 1
    },
  },
  {
    id: 'unlock_organic',
    title: 'Unlock Organics',
    desc: 'Adds bananas, apples, foliage to the Queue.',
    type: 'unlock',
    cost: 0,
    owned: (m) => m.unlockedOrganic,
    canBuy: (m) => !m.unlockedOrganic,
    apply: (m) => {
      m.unlockedOrganic = true
    },
  },
  {
    id: 'unlock_electronics',
    title: 'Unlock Electronics',
    desc: 'Adds high-value Chips, Phones, Boards. Needs Organics.',
    type: 'unlock',
    cost: 0,
    owned: (m) => m.unlockedElectronics,
    canBuy: (m) => m.unlockedOrganic && !m.unlockedElectronics,
    apply: (m) => {
      m.unlockedElectronics = true
    },
  },
  {
    id: 'metal_refinery',
    title: 'Metal Refinery',
    desc: '+50% value for all Metal cells and alloys.',
    type: 'multiplier',
    cost: 0,
    owned: (m) => m.metalValueBonus >= 0.5,
    canBuy: (m) => m.metalValueBonus < 0.5,
    apply: (m) => {
      m.metalValueBonus = 0.5
    },
  },
  {
    id: 'density_overdrive',
    title: 'Precision Press',
    desc: '2× payout when Density hits 90%+.',
    type: 'multiplier',
    cost: 0,
    owned: (m) => m.densityBonusFactor >= 1,
    canBuy: (m) => m.densityBonusFactor < 1,
    apply: (m) => {
      m.densityBonusFactor = 1
    },
  },
  {
    id: 'clear_overload',
    title: 'Coolant Flush',
    desc: 'Clears 1 Overload Stress warning light.',
    type: 'utility',
    cost: 0,
    owned: () => false,
    canBuy: () => true,
    apply: () => {
      /* run.overflow cleared in pickDraft */
    },
  },
  {
    id: 'extra_queue',
    title: 'Extended Queue',
    desc: '+1 Queue slot — see more upcoming scrap.',
    type: 'utility',
    cost: 0,
    owned: (m) => m.queueSize >= 5,
    canBuy: (m) => m.queueSize < 5,
    apply: (m) => {
      m.queueSize += 1
    },
  },
  {
    id: 'recipe',
    title: 'P+M Alloy',
    desc: 'Plastic next to Metal becomes a bonus pair.',
    type: 'multiplier',
    cost: 0,
    owned: (m) => m.recipePlasticMetal,
    canBuy: (m) => !m.recipePlasticMetal,
    apply: (m) => {
      m.recipePlasticMetal = true
    },
  },
  {
    id: 'sorter',
    title: 'Auto-Sort',
    desc: 'Queue groups by material automatically.',
    type: 'utility',
    cost: 0,
    owned: (m) => m.autoSorter,
    canBuy: (m) => !m.autoSorter,
    apply: (m) => {
      m.autoSorter = true
    },
  },
]

/** @deprecated alias — draft uses UPGRADE_POOL */
export const SHOP = UPGRADE_POOL

export function shopCost(item: ShopItem, _meta: MetaState): number {
  return item.cost
}

export function pickDraftOptions(meta: MetaState, count = 3): ShopItem[] {
  // Exclude always-available coolant from the main shuffle so it doesn't dominate
  const core = UPGRADE_POOL.filter(
    (i) => i.id !== 'clear_overload' && i.canBuy(meta) && !i.owned(meta),
  )
  const coolant = UPGRADE_POOL.find((i) => i.id === 'clear_overload')!

  const out: ShopItem[] = []
  const used = new Set<string>()
  for (const item of shuffle(core)) {
    if (out.length >= count) break
    used.add(item.id)
    out.push(item)
  }

  while (out.length < count) {
    if (!used.has(coolant.id)) {
      used.add(coolant.id)
      out.push(coolant)
      continue
    }
    break
  }

  return out.slice(0, count)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

import type { LeaderboardEntry, MetaState } from './types'
import { SAVE_KEY } from './types'

export const DEFAULT_META: MetaState = {
  credits: 0,
  bestRun: 0,
  bestBlock: 0,
  gridSize: 5,
  unlockedOrganic: false,
  unlockedElectronics: false,
  recipePlasticMetal: false,
  autoSorter: false,
  tutorialDone: false,
  metalValueBonus: 0,
  densityBonusFactor: 0,
  queueSize: 3,
  leaderboard: [],
}

export {
  UPGRADE_POOL,
  SHOP,
  gridCost,
  shopCost,
  pickDraftOptions,
  type ShopItem,
} from './shop'

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return { ...DEFAULT_META, leaderboard: [] }
    const parsed = JSON.parse(raw) as Partial<MetaState>
    return {
      ...DEFAULT_META,
      ...parsed,
      metalValueBonus: Number(parsed.metalValueBonus) || 0,
      densityBonusFactor: Number(parsed.densityBonusFactor) || 0,
      queueSize: Math.max(3, Number(parsed.queueSize) || 3),
      leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : [],
    }
  } catch {
    return { ...DEFAULT_META, leaderboard: [] }
  }
}

export function saveMeta(meta: MetaState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(meta))
}

export function pushLeaderboard(meta: MetaState, score: number, name = 'OPERATOR'): LeaderboardEntry[] {
  const entry: LeaderboardEntry = {
    score,
    at: Date.now(),
    name: name.trim().toUpperCase().slice(0, 10) || 'OPERATOR',
  }
  const next = [...meta.leaderboard, entry].sort((a, b) => b.score - a.score).slice(0, 10)
  meta.leaderboard = next
  saveMeta(meta)
  return next
}

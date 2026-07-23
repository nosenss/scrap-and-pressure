export type MaterialId = 'plastic' | 'metal' | 'glass' | 'organic' | 'electronics'

export type Cell = {
  material: MaterialId
  itemId: string
  placementId: string
} | null

export type Placement = {
  id: string
  itemId: string
  material: MaterialId
  cells: Array<[number, number]>
  rot: number
}

export type Piece = {
  material: MaterialId
  itemId: string
  itemName: string
  cells: Array<[number, number]>
  baseValue: number
  rot: number
}

export type ScoreBreakdown = {
  occupied: number
  total: number
  density: number
  base: number
  penalty: number
  alloyMult: number
  value: number
}

export type LeaderboardEntry = {
  score: number
  at: number
  name: string
}

export type MetaState = {
  credits: number
  bestRun: number
  bestBlock: number
  gridSize: number
  unlockedOrganic: boolean
  unlockedElectronics: boolean
  recipePlasticMetal: boolean
  autoSorter: boolean
  tutorialDone: boolean
  /** Extra metal cell value multiplier (0 = none, 0.5 = +50%). */
  metalValueBonus: number
  /** Extra payout factor at 90%+ density (1 = double total value). */
  densityBonusFactor: number
  /** Visible queue length (default 3). */
  queueSize: number
  leaderboard: LeaderboardEntry[]
}

export const MATERIAL_META: Record<
  MaterialId,
  { name: string; color: string; basePerCell: number; weight: number }
> = {
  plastic: { name: 'Plastic', color: '#3aa0c8', basePerCell: 4, weight: 40 },
  metal: { name: 'Metal', color: '#8b9299', basePerCell: 7, weight: 28 },
  glass: { name: 'Glass', color: '#5aaa78', basePerCell: 6, weight: 24 },
  organic: { name: 'Organic', color: '#b87a4a', basePerCell: 3, weight: 18 },
  electronics: { name: 'Electronics', color: '#7d6bb0', basePerCell: 11, weight: 12 },
}

export const SAVE_KEY = 'compactor-meta-v2'
export const LB_KEY = 'compactor-lb-v1'

import type { Cell, MaterialId, MetaState, ScoreBreakdown } from './types'
import { MATERIAL_META } from './types'

const DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

function inBounds(size: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size
}

/** Contiguous same-material clusters; bonus if cluster has no empty 4-neighb holes inside bbox (simple "solid" check). */
function alloyMultiplier(grid: Cell[][], size: number): number {
  const seen = Array.from({ length: size }, () => Array(size).fill(false))
  let mult = 1

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = grid[y]![x]
      if (!cell || seen[y]![x]) continue

      const mat = cell.material
      const stack: Array<[number, number]> = [[x, y]]
      seen[y]![x] = true
      const members: Array<[number, number]> = []

      while (stack.length) {
        const [cx, cy] = stack.pop()!
        members.push([cx, cy])
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx
          const ny = cy + dy
          if (!inBounds(size, nx, ny) || seen[ny]![nx]) continue
          const n = grid[ny]![nx]
          if (n && n.material === mat) {
            seen[ny]![nx] = true
            stack.push([nx, ny])
          }
        }
      }

      if (members.length < 4) continue

      // solid if every empty cell in cluster bbox is NOT fully enclosed by this material
      // simpler jam rule: no empty neighbor that is surrounded on 4 sides by this cluster's material cells
      let holes = 0
      const set = new Set(members.map(([mx, my]) => `${mx},${my}`))
      const minX = Math.min(...members.map((m) => m[0]))
      const maxX = Math.max(...members.map((m) => m[0]))
      const minY = Math.min(...members.map((m) => m[1]))
      const maxY = Math.max(...members.map((m) => m[1]))

      for (let hy = minY; hy <= maxY; hy++) {
        for (let hx = minX; hx <= maxX; hx++) {
          if (set.has(`${hx},${hy}`)) continue
          if (grid[hy]![hx]) continue
          let enclosed = 0
          for (const [dx, dy] of DIRS) {
            if (set.has(`${hx + dx},${hy + dy}`)) enclosed++
          }
          if (enclosed >= 3) holes++
        }
      }

      if (holes === 0) {
        // +0.15 per solid cluster, capped softly
        mult += 0.12 + members.length * 0.02
      }
    }
  }

  return Math.min(2.2, mult)
}

function isRecipePair(a: MaterialId, b: MaterialId, meta: MetaState): boolean {
  if (!meta.recipePlasticMetal) return false
  return (
    (a === 'plastic' && b === 'metal') ||
    (a === 'metal' && b === 'plastic')
  )
}

function contactPenalty(a: MaterialId, b: MaterialId, meta: MetaState): number {
  if (a === b) return 0
  // glass + metal always harsh (fragile)
  if ((a === 'glass' && b === 'metal') || (a === 'metal' && b === 'glass')) return 8
  if (isRecipePair(a, b, meta)) return -4 // bonus as negative penalty
  // organic soft mixing
  if (a === 'organic' || b === 'organic') return 2
  return 5
}

export function scoreGrid(grid: Cell[][], size: number, meta: MetaState): ScoreBreakdown {
  let occupied = 0
  let base = 0

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = grid[y]![x]
      if (!c) continue
      occupied++
      let cellValue = MATERIAL_META[c.material].basePerCell
      if (c.material === 'metal' && meta.metalValueBonus > 0) {
        cellValue *= 1 + meta.metalValueBonus
      }
      base += cellValue
      // organic density bonus baked as +1 base per organic cell when any neighbor empty? skip — density already rewards fill
    }
  }

  const total = size * size
  const density = total === 0 ? 0 : occupied / total

  let penalty = 0
  const seenEdges = new Set<string>()

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = grid[y]![x]
      if (!a) continue
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ] as const) {
        const nx = x + dx
        const ny = y + dy
        if (!inBounds(size, nx, ny)) continue
        const b = grid[ny]![nx]
        if (!b) continue
        const key = `${x},${y}:${nx},${ny}`
        if (seenEdges.has(key)) continue
        seenEdges.add(key)
        penalty += contactPenalty(a.material, b.material, meta)
      }
    }
  }

  // organic fill bonus: each organic adjacent to empty cell softens density feel via small base bump
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = grid[y]![x]
      if (!c || c.material !== 'organic') continue
      for (const [dx, dy] of DIRS) {
        const nx = x + dx
        const ny = y + dy
        if (inBounds(size, nx, ny) && !grid[ny]![nx]) {
          base += 1
          break
        }
      }
    }
  }

  const alloyMult = occupied === 0 ? 1 : alloyMultiplier(grid, size)
  let raw = base * density * alloyMult - Math.max(0, penalty)
  if (occupied > 0 && density >= 0.9 && meta.densityBonusFactor > 0) {
    raw *= 1 + meta.densityBonusFactor
  }
  const value = occupied === 0 ? 0 : Math.max(0, Math.round(raw))

  return {
    occupied,
    total,
    density,
    base,
    penalty: Math.max(0, penalty),
    alloyMult,
    value,
  }
}

export function canPlace(
  grid: Cell[][],
  size: number,
  cells: Array<[number, number]>,
  ox: number,
  oy: number,
): boolean {
  for (const [cx, cy] of cells) {
    const x = ox + cx
    const y = oy + cy
    if (!inBounds(size, x, y)) return false
    if (grid[y]![x]) return false
  }
  return true
}

export function findAnyPlacement(
  grid: Cell[][],
  size: number,
  cells: Array<[number, number]>,
): { x: number; y: number } | null {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (canPlace(grid, size, cells, x, y)) return { x, y }
    }
  }
  return null
}

export function placePiece(
  grid: Cell[][],
  cells: Array<[number, number]>,
  ox: number,
  oy: number,
  material: MaterialId,
  itemId: string,
  placementId: string,
): Array<[number, number]> {
  const abs: Array<[number, number]> = []
  for (const [cx, cy] of cells) {
    const x = ox + cx
    const y = oy + cy
    grid[y]![x] = { material, itemId, placementId }
    abs.push([x, y])
  }
  return abs
}

/** Force-place: write over empties first; if needed overwrite foreign cells (creates mess). */
export function forcePlace(
  grid: Cell[][],
  size: number,
  cells: Array<[number, number]>,
  material: MaterialId,
  itemId: string,
  placementId: string,
): Array<[number, number]> {
  const spot = findAnyPlacement(grid, size, cells)
  if (spot) {
    return placePiece(grid, cells, spot.x, spot.y, material, itemId, placementId)
  }

  let ox = 0
  let oy = 0
  outer: for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      ox = x
      oy = y
      break outer
    }
  }

  const abs: Array<[number, number]> = []
  for (const [cx, cy] of cells) {
    const x = Math.min(size - 1, Math.max(0, ox + cx))
    const y = Math.min(size - 1, Math.max(0, oy + cy))
    if (grid[y]![x] && grid[y]![x]!.material !== material) {
      for (const [dx, dy] of DIRS) {
        const nx = x + dx
        const ny = y + dy
        if (inBounds(size, nx, ny) && grid[ny]![nx]) {
          grid[ny]![nx] = null
          break
        }
      }
    }
    grid[y]![x] = { material, itemId, placementId }
    abs.push([x, y])
  }
  return abs
}

export function emptyGrid(size: number): Cell[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null))
}

export function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) => row.map((c) => (c ? { ...c } : null)))
}

export type ContactHint = {
  x: number
  y: number
  kind: 'good' | 'bad'
}

/** Neighbors the ghost would touch — good recipe / same-mat cluster vs harsh contacts. */
export function ghostContactHints(
  grid: Cell[][],
  size: number,
  cells: Array<[number, number]>,
  ox: number,
  oy: number,
  material: MaterialId,
  meta: MetaState,
): ContactHint[] {
  const ghost = new Set(cells.map(([cx, cy]) => `${ox + cx},${oy + cy}`))
  const hints: ContactHint[] = []
  const seen = new Set<string>()

  for (const [cx, cy] of cells) {
    const x = ox + cx
    const y = oy + cy
    for (const [dx, dy] of DIRS) {
      const nx = x + dx
      const ny = y + dy
      if (!inBounds(size, nx, ny)) continue
      if (ghost.has(`${nx},${ny}`)) continue
      const n = grid[ny]![nx]
      if (!n) continue
      const key = `${Math.min(x, nx)},${Math.min(y, ny)}:${Math.max(x, nx)},${Math.max(y, ny)}`
      if (seen.has(key)) continue
      seen.add(key)
      const pen = contactPenalty(material, n.material, meta)
      if (pen < 0 || (pen === 0 && material === n.material)) {
        hints.push({ x: nx, y: ny, kind: 'good' })
      } else if (pen >= 5) {
        hints.push({ x: nx, y: ny, kind: 'bad' })
      }
    }
  }
  return hints
}

/** Score if ghost piece were placed (does not mutate grid). */
export function previewScoreWithGhost(
  grid: Cell[][],
  size: number,
  cells: Array<[number, number]>,
  ox: number,
  oy: number,
  material: MaterialId,
  meta: MetaState,
): ScoreBreakdown {
  const g = cloneGrid(grid)
  placePiece(g, cells, ox, oy, material, '_ghost', '_ghost')
  return scoreGrid(g, size, meta)
}

import type { MaterialId, Piece } from './types'
import { MATERIAL_META } from './types'

/** Scrap objects — silhouettes of real junk, not tetromino presets. */
type ItemDef = {
  id: string
  name: string
  material: MaterialId
  cells: Array<[number, number]>
  weight: number
}

const ITEMS: ItemDef[] = [
  // plastic
  { id: 'bottle', name: 'Bottle', material: 'plastic', weight: 22, cells: [[1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] },
  { id: 'canister', name: 'Canister', material: 'plastic', weight: 16, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]] },
  { id: 'brick', name: 'Brick', material: 'plastic', weight: 18, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: 'lid', name: 'Lid', material: 'plastic', weight: 14, cells: [[0, 0], [1, 0], [2, 0]] },
  // metal
  { id: 'tin', name: 'Tin', material: 'metal', weight: 20, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: 'wrench', name: 'Key', material: 'metal', weight: 16, cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
  { id: 'pipe', name: 'Pipe', material: 'metal', weight: 14, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { id: 'plate', name: 'Plate', material: 'metal', weight: 12, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
  // glass
  { id: 'flask', name: 'Vial', material: 'glass', weight: 16, cells: [[1, 0], [1, 1], [0, 2], [1, 2], [2, 2]] },
  { id: 'shard', name: 'Shard', material: 'glass', weight: 18, cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
  { id: 'pane', name: 'Pane', material: 'glass', weight: 12, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: 'jar', name: 'Jar', material: 'glass', weight: 14, cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] },
  // organic
  { id: 'banana', name: 'Bananas', material: 'organic', weight: 16, cells: [[0, 1], [1, 0], [1, 1], [2, 1], [2, 2]] },
  { id: 'apple', name: 'Apple', material: 'organic', weight: 14, cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
  { id: 'leaf', name: 'Foliage', material: 'organic', weight: 12, cells: [[0, 0], [1, 0], [1, 1]] },
  // electronics
  { id: 'chip', name: 'Chip', material: 'electronics', weight: 14, cells: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]] },
  { id: 'phone', name: 'Phone', material: 'electronics', weight: 12, cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] },
  { id: 'board', name: 'Board', material: 'electronics', weight: 10, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]] },
]

function normalize(cells: Array<[number, number]>): Array<[number, number]> {
  const minX = Math.min(...cells.map((c) => c[0]))
  const minY = Math.min(...cells.map((c) => c[1]))
  return cells
    .map(([x, y]) => [x - minX, y - minY] as [number, number])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
}

export function rotateCells(cells: Array<[number, number]>): Array<[number, number]> {
  return normalize(cells.map(([x, y]) => [y, -x]))
}

export function pieceBounds(cells: Array<[number, number]>): { w: number; h: number } {
  return {
    w: Math.max(...cells.map((c) => c[0])) + 1,
    h: Math.max(...cells.map((c) => c[1])) + 1,
  }
}

function toPiece(def: ItemDef): Piece {
  const cells = normalize(def.cells.map((c) => [...c] as [number, number]))
  return {
    material: def.material,
    itemId: def.id,
    itemName: def.name,
    cells,
    baseValue: cells.length * MATERIAL_META[def.material].basePerCell,
    rot: 0,
  }
}

export function createPiece(
  unlocked: { organic: boolean; electronics: boolean },
  forcedId?: string,
): Piece {
  if (forcedId) {
    const def = ITEMS.find((i) => i.id === forcedId)
    if (def) {
      // Never force a locked category item
      if (def.material === 'organic' && !unlocked.organic) {
        /* fall through to random pool */
      } else if (def.material === 'electronics' && !unlocked.electronics) {
        /* fall through to random pool */
      } else {
        return toPiece(def)
      }
    }
  }

  const pool = ITEMS.filter((i) => {
    if (i.material === 'organic') return unlocked.organic
    if (i.material === 'electronics') return unlocked.electronics
    // plastic | metal | glass — always available at start
    return i.material === 'plastic' || i.material === 'metal' || i.material === 'glass'
  })

  if (pool.length === 0) {
    return toPiece(ITEMS.find((i) => i.material === 'plastic')!)
  }

  const total = pool.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of pool) {
    r -= item.weight
    if (r <= 0) return toPiece(item)
  }
  return toPiece(pool[pool.length - 1]!)
}

/** Group upcoming scrap by material — keep queue[0] (active piece) stable for FIFO. */
export function sortQueueByMaterial(queue: Piece[]): Piece[] {
  if (queue.length <= 1) return [...queue]
  const order: MaterialId[] = ['plastic', 'metal', 'glass', 'organic', 'electronics']
  const head = queue[0]!
  const rest = queue.slice(1).sort(
    (a, b) => order.indexOf(a.material) - order.indexOf(b.material) || b.baseValue - a.baseValue,
  )
  return [head, ...rest]
}

export function itemList(): ItemDef[] {
  return ITEMS
}

import type { MaterialId, MetaState, Piece } from './types'
import { createPiece, itemList } from './shapes'

export type UnlockedCategories = {
  plastic: boolean
  metal: boolean
  glass: boolean
  organic: boolean
  electronics: boolean
}

/** Base scrap always open; organics/electronics gated by meta unlocks. */
export function getUnlockedCategories(meta: MetaState): UnlockedCategories {
  return {
    plastic: true,
    metal: true,
    glass: true,
    organic: meta.unlockedOrganic,
    electronics: meta.unlockedElectronics,
  }
}

export function unlockedCategoryIds(meta: MetaState): MaterialId[] {
  const u = getUnlockedCategories(meta)
  return (Object.keys(u) as MaterialId[]).filter((k) => u[k])
}

/**
 * Random piece from unlocked materials only — never chips/electronics
 * until Unlock Electronics is owned.
 */
export function getRandomItem(meta: MetaState, forcedId?: string): Piece {
  const unlocked = {
    organic: meta.unlockedOrganic,
    electronics: meta.unlockedElectronics,
  }
  const piece = createPiece(unlocked, forcedId)
  // Hard reject locked materials (defensive — createPiece already filters)
  const allowed = new Set(unlockedCategoryIds(meta))
  if (!allowed.has(piece.material)) {
    const fallback = itemList().find((i) => allowed.has(i.material))
    if (fallback) return createPiece(unlocked, fallback.id)
  }
  return piece
}

export function queueTargetLength(meta: MetaState): number {
  return Math.max(3, meta.queueSize || 3)
}

/** Fill until target length; only unlocked categories. */
export function fillQueue(queue: Piece[], meta: MetaState, opts?: { tutorial?: boolean; tutIndex?: number }): void {
  const target = queueTargetLength(meta)
  while (queue.length < target) {
    if (opts?.tutorial && (opts.tutIndex ?? 0) <= 1) {
      queue.push(getRandomItem(meta, (opts.tutIndex ?? 0) === 0 ? 'bottle' : 'wrench'))
    } else if (opts?.tutorial) {
      queue.push(getRandomItem(meta, 'tin'))
    } else {
      queue.push(getRandomItem(meta))
    }
  }
}

/**
 * FIFO after a successful place (or overflow discard of head):
 * shift head → remaining slide up → push one new unlocked item to tail.
 */
export function onShapePlaced(queue: Piece[], meta: MetaState): Piece[] {
  queue.shift()
  queue.push(getRandomItem(meta))
  // Keep length if Extended Queue / race conditions
  const target = queueTargetLength(meta)
  while (queue.length < target) queue.push(getRandomItem(meta))
  while (queue.length > target) queue.pop()
  return queue
}

/** Drop any locked-category pieces (e.g. after load / stale draft). */
export function sanitizeQueue(queue: Piece[], meta: MetaState): Piece[] {
  const allowed = new Set(unlockedCategoryIds(meta))
  const cleaned = queue.filter((p) => allowed.has(p.material))
  fillQueue(cleaned, meta)
  return cleaned
}

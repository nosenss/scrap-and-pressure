/**
 * Promo capture hooks — enabled with ?promo=1
 * Exposed as window.__PROMO for Playwright.
 */
import type { Cell, MetaState, Piece, Placement } from './types'
import { emptyGrid } from './scoring'
import { createPiece, rotateCells } from './shapes'
import { UPGRADE_POOL, type ShopItem } from './shop'

export type PromoApi = {
  ready: true
  skipBoot: () => void
  mute: () => void
  lockScale: () => void
  setupTitle: () => void
  setupGameplay: () => void
  setupLeaderboard: () => void
  setupPressReady: () => void
  setupPackingGhost: () => void
  setupUpgradeDraft: () => void
  press: () => void
  rotate: () => void
  placeGhost: () => void
  pickChamberExpansion: () => void
  toastPerfect: () => void
  closeOverlays: () => void
}

type PromoDeps = {
  el: {
    boot?: Element | null
    title: Element
    game: Element
    draft: Element
    draftCards: Element
    leaderboard: Element
    gameover: Element
    toast: Element
    btnPress: HTMLButtonElement
  }
  getMeta: () => MetaState
  setMeta: (m: MetaState) => void
  getRun: () => {
    grid: Cell[][]
    size: number
    queue: Piece[]
    placements: Placement[]
    overflow: number
    runScore: number
    ended: boolean
    hover: { x: number; y: number } | null
    tutorial: boolean
    tutIndex: number
    pressCount: number
    pressesSinceLastDraft: number
    lastDraftAtCredits: number
  } | null
  setRun: (r: NonNullable<ReturnType<PromoDeps['getRun']>>) => void
  setPlaceOrigin: (o: { x: number; y: number } | null) => void
  setGhostValid: (v: boolean) => void
  setPaused: (v: boolean) => void
  setQueueArmed: (v: boolean) => void
  setPhase: (p: 'title' | 'tutorial' | 'play') => void
  startRun: (tutorial: boolean) => void
  persist: () => void
  renderAll: () => void
  openLb: () => void
  doPress: () => void
  rotateCurrent: () => void
  tryPlace: (ox: number, oy: number) => void
  pickDraft: (item: ShopItem) => void
  showToast: (msg: string, ms?: number) => void
  setAudioMuted: (muted: boolean) => void
  stopMusic: () => void
  DEFAULT_META: MetaState
}

function closeOverlays(deps: PromoDeps): void {
  deps.el.draft.classList.add('hidden')
  deps.el.leaderboard.classList.add('hidden')
  deps.el.gameover.classList.add('hidden')
  deps.setPaused(false)
}

function metalTin(): Piece {
  return createPiece({ organic: false, electronics: false }, 'tin')
}

function metalPlate(): Piece {
  return createPiece({ organic: false, electronics: false }, 'plate')
}

function metalWrench(): Piece {
  return createPiece({ organic: false, electronics: false }, 'wrench')
}

/** Pack ~80%+ of a 5×5 with metal tins (2×2), leave a hole for the last tin. */
function packChamber(
  size: number,
): { grid: Cell[][]; placements: Placement[] } {
  const grid = emptyGrid(size)
  const placements: Placement[] = []
  let id = 0
  const spots: Array<[number, number]> = [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
    [3, 3], // partial — we'll place tin carefully
  ]
  // Fill 0,0 / 2,0 / 0,2 / 2,2 with 2×2 tins = 16 cells; add more metal singles via plate rows
  for (const [ox, oy] of [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ] as Array<[number, number]>) {
    const p = metalTin()
    const pid = `promo-${id++}`
    const cells: Array<[number, number]> = []
    for (const [cx, cy] of p.cells) {
      const x = ox + cx
      const y = oy + cy
      if (x >= size || y >= size) continue
      grid[y]![x] = { material: 'metal', itemId: 'tin', placementId: pid }
      cells.push([x, y])
    }
    placements.push({ id: pid, itemId: 'tin', material: 'metal', cells, rot: 0 })
  }
  // Fill remaining empties except bottom-right 2×2 hole for last place
  const hole = new Set(['3,3', '4,3', '3,4', '4,4'])
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y]![x]) continue
      if (hole.has(`${x},${y}`)) continue
      const pid = `promo-fill-${id++}`
      grid[y]![x] = { material: 'metal', itemId: 'plate', placementId: pid }
      placements.push({
        id: pid,
        itemId: 'plate',
        material: 'metal',
        cells: [[x, y]],
        rot: 0,
      })
    }
  }
  void spots
  return { grid, placements }
}

export function installPromoApi(deps: PromoDeps): PromoApi {
  const api: PromoApi = {
    ready: true,

    skipBoot() {
      document.getElementById('boot-screen')?.remove()
      document.body.classList.add('promo-capture')
    },

    mute() {
      deps.setAudioMuted(true)
      deps.stopMusic()
    },

    lockScale() {
      const wrapper = document.getElementById('game-wrapper')
      if (wrapper) {
        wrapper.style.transform = 'scale(1)'
        wrapper.style.transformOrigin = 'top left'
      }
      // Freeze auto-rescale
      ;(window as unknown as { __promoLockScale?: boolean }).__promoLockScale = true
    },

    setupTitle() {
      closeOverlays(deps)
      deps.setPhase('title')
    },

    setupGameplay() {
      closeOverlays(deps)
      const meta = deps.getMeta()
      meta.tutorialDone = true
      meta.gridSize = 5
      meta.credits = 420
      meta.bestRun = 980
      deps.setMeta(meta)
      deps.persist()
      deps.startRun(false)
      const run = deps.getRun()
      if (!run) return
      const packed = packChamber(5)
      run.grid = packed.grid
      run.placements = packed.placements
      run.overflow = 2
      run.runScore = 640
      run.queue = [metalTin(), metalWrench(), metalPlate()]
      deps.setRun(run)
      deps.setQueueArmed(true)
      // Ghost preview over the empty hole
      deps.setPlaceOrigin({ x: 3, y: 3 })
      deps.setGhostValid(true)
      run.hover = { x: 3, y: 3 }
      deps.renderAll()
    },

    setupLeaderboard() {
      closeOverlays(deps)
      const meta = deps.getMeta()
      meta.leaderboard = [
        { name: 'OPERATOR', score: 12450, at: Date.now() },
        { name: 'SCRAPDOG', score: 9800, at: Date.now() - 1 },
        { name: 'PRESSKING', score: 7200, at: Date.now() - 2 },
        { name: 'BINRAT', score: 4100, at: Date.now() - 3 },
      ]
      meta.bestRun = 12450
      deps.setMeta(meta)
      deps.persist()
      deps.setPhase('title')
      deps.openLb()
    },

    setupPressReady() {
      closeOverlays(deps)
      api.setupGameplay()
      closeOverlays(deps)
      const run = deps.getRun()
      if (!run) return
      // Fill the last hole so chamber is ready to crush
      const p = metalTin()
      const pid = 'promo-last'
      const cells: Array<[number, number]> = []
      for (const [cx, cy] of p.cells) {
        const x = 3 + cx
        const y = 3 + cy
        if (x >= 5 || y >= 5) continue
        run.grid[y]![x] = { material: 'metal', itemId: 'tin', placementId: pid }
        cells.push([x, y])
      }
      run.placements.push({
        id: pid,
        itemId: 'tin',
        material: 'metal',
        cells,
        rot: 0,
      })
      run.queue = [metalWrench(), metalPlate(), metalTin()]
      // Keep press GIF on the slam — don't open upgrade draft after payout
      run.lastDraftAtCredits = 1_000_000
      run.pressesSinceLastDraft = 0
      deps.setPlaceOrigin(null)
      deps.setGhostValid(false)
      run.hover = null
      deps.setRun(run)
      deps.renderAll()
    },

    setupPackingGhost() {
      closeOverlays(deps)
      const meta = deps.getMeta()
      meta.tutorialDone = true
      meta.gridSize = 5
      deps.setMeta(meta)
      deps.persist()
      deps.startRun(false)
      const run = deps.getRun()
      if (!run) return
      // Sparse metal cluster so alloy ghost is visible
      const packed = packChamber(5)
      // Clear a bigger area for wrench rotations
      for (const key of ['1,1', '2,1', '3,1', '1,2', '2,2', '3,2', '1,3', '2,3', '3,3']) {
        const [x, y] = key.split(',').map(Number) as [number, number]
        const cell = packed.grid[y]![x]
        if (cell) {
          packed.placements = packed.placements.filter((pl) => pl.id !== cell.placementId)
          packed.grid[y]![x] = null
        }
      }
      run.grid = packed.grid
      run.placements = packed.placements
      let wrench = metalWrench()
      // Orient for a nice ghost
      wrench.cells = rotateCells(wrench.cells)
      wrench.rot = 1
      run.queue = [wrench, metalTin(), metalPlate()]
      deps.setRun(run)
      deps.setQueueArmed(true)
      deps.setPlaceOrigin({ x: 1, y: 1 })
      deps.setGhostValid(true)
      run.hover = { x: 1, y: 1 }
      deps.renderAll()
    },

    setupUpgradeDraft() {
      closeOverlays(deps)
      const meta = deps.getMeta()
      meta.tutorialDone = true
      meta.gridSize = 5
      meta.credits = 200
      deps.setMeta(meta)
      deps.persist()
      deps.startRun(false)
      const run = deps.getRun()
      if (!run) return
      const packed = packChamber(5)
      // Fill hole so post-press feel
      for (const [x, y] of [
        [3, 3],
        [4, 3],
        [3, 4],
        [4, 4],
      ] as Array<[number, number]>) {
        packed.grid[y]![x] = {
          material: 'metal',
          itemId: 'tin',
          placementId: 'promo-full',
        }
      }
      run.grid = packed.grid
      run.placements = packed.placements
      run.runScore = 880
      deps.setRun(run)
      deps.setPaused(true)
      deps.renderAll()

      const expand = UPGRADE_POOL.find((i) => i.id === 'expand_chamber')!
      const extras = UPGRADE_POOL.filter(
        (i) => i.id !== 'expand_chamber' && i.canBuy(meta) && !i.owned(meta),
      ).slice(0, 2)
      const cards = [expand, ...extras]
      deps.el.draftCards.replaceChildren()
      for (const item of cards) {
        const card = document.createElement('button')
        card.type = 'button'
        card.className = 'draft-card'
        card.dataset.promoId = item.id
        card.innerHTML = `<strong>${item.title}</strong><span>${item.desc}</span>`
        card.addEventListener('click', () => deps.pickDraft(item))
        deps.el.draftCards.appendChild(card)
      }
      deps.el.draft.classList.remove('hidden')
    },

    press() {
      deps.doPress()
      // Belt-and-suspenders: crush animation must not leave draft/LB over the clip
      window.setTimeout(() => closeOverlays(deps), 280)
    },

    rotate() {
      deps.rotateCurrent()
    },

    placeGhost() {
      const run = deps.getRun()
      if (!run) return
      // Place at current ghost origin (1,1 from packing setup)
      deps.tryPlace(1, 1)
    },

    pickChamberExpansion() {
      const expand = UPGRADE_POOL.find((i) => i.id === 'expand_chamber')!
      deps.pickDraft(expand)
    },

    toastPerfect() {
      deps.showToast('+$1,200 PERFECT PRESS!', 2500)
    },

    closeOverlays() {
      closeOverlays(deps)
    },
  }

  ;(window as unknown as { __PROMO: PromoApi }).__PROMO = api
  return api
}

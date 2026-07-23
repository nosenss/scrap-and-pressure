import {
  canPlace,
  emptyGrid,
  findAnyPlacement,
  forcePlace,
  ghostContactHints,
  placePiece,
  previewScoreWithGhost,
  scoreGrid,
} from './scoring'
import { rotateCells, sortQueueByMaterial, pieceBounds } from './shapes'
import { fillQueue, onShapePlaced, sanitizeQueue } from './queue'
import {
  loadMeta,
  saveMeta,
  pickDraftOptions,
  pushLeaderboard,
  DEFAULT_META,
  type ShopItem,
} from './meta'
import type { Cell, MetaState, Piece, Placement, ScoreBreakdown } from './types'
import { LB_KEY, MATERIAL_META, SAVE_KEY } from './types'
import {
  getAudioSettings,
  playOverloadAlarm,
  playPlace,
  playPress,
  playSfx,
  playMenuMusic,
  playGameMusic,
  preloadSfx,
  setAudioSettings,
  setDangerAmbience,
  stopMusic,
  unlockAudio,
} from './audio'
import {
  burstSparks,
  densityBand,
  densityToNeedleDeg,
  flyCash,
  formatMoney,
  shakeStation,
  showBriquette,
} from './feel'
import './style.css'
import { mountIndustrialWarp } from './bg-shader'
import {
  initAnalytics,
  trackGameOver,
  trackOverload,
  trackPlace,
  trackPowerOn,
  trackPress,
  trackRunStart,
  trackTutorialDone,
  trackUpgrade,
} from './analytics'
import { assetUrl } from './assets'
import { installPromoApi } from './promo-api'

type Phase = 'title' | 'tutorial' | 'play'

/** Wipe save + tutorial when opening /?reset=1 (or #reset). */
;(function wipeProgressIfRequested() {
  const url = new URL(location.href)
  const wantsReset = url.searchParams.get('reset') === '1' || url.hash === '#reset'
  if (!wantsReset) return
  localStorage.removeItem(SAVE_KEY)
  localStorage.removeItem(LB_KEY)
  localStorage.removeItem('compactor_tutorial_done')
  url.searchParams.delete('reset')
  url.hash = ''
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
})()

const el = {
  title: document.querySelector('#title')!,
  game: document.querySelector('#game')!,
  station: document.querySelector<HTMLElement>('#station')!,
  btnTutSkip: document.querySelector<HTMLButtonElement>('#btn-tut-skip')!,
  btnTitleLb: document.querySelector<HTMLButtonElement>('#btn-start-records')!,
  credits: document.querySelector('#credits')!,
  runScore: document.querySelector('#run-score')!,
  bestRun: document.querySelector('#best-run')!,
  bestBlock: document.querySelector('#best-block')!,
  queue: document.querySelector('#queue')!,
  queueRail: document.querySelector<HTMLElement>('#queue-panel')!,
  grid: document.querySelector<HTMLDivElement>('#grid')!,
  overflow: document.querySelector('#overflow')!,
  overflowText: document.querySelector('#overflow-text')!,
  toast: document.querySelector('#toast')!,
  legend: document.querySelector('#legend')!,
  prevDensity: document.querySelector('#prev-density')!,
  prevBase: document.querySelector('#prev-base')!,
  prevPenalty: document.querySelector('#prev-penalty')!,
  prevAlloy: document.querySelector('#prev-alloy')!,
  prevValue: document.querySelector('#prev-value')!,
  valueDelta: document.querySelector('#value-delta')!,
  densityLabel: document.querySelector('#density-label')!,
  manoNeedle: document.querySelector<HTMLElement>('#mano-needle')!,
  manoPct: document.querySelector('#mano-pct')!,
  manoStatus: document.querySelector('#mano-status')!,
  dangerPanel: document.querySelector<HTMLElement>('#danger-panel')!,
  btnPress: document.querySelector<HTMLButtonElement>('#btn-press')!,
  btnRotate: document.querySelector<HTMLButtonElement>('#btn-rotate')!,
  btnLb: document.querySelector<HTMLButtonElement>('#btn-records')!,
  btnLbClose: document.querySelector<HTMLButtonElement>('#btn-lb-close')!,
  btnSaveScore: document.querySelector<HTMLButtonElement>('#btn-save-score')!,
  btnOverMenu: document.querySelector<HTMLButtonElement>('#btn-over-menu')!,
  playerNickname: document.querySelector<HTMLInputElement>('#player-nickname')!,
  draft: document.querySelector('#draft')!,
  draftCards: document.querySelector('#draft-cards')!,
  leaderboard: document.querySelector('#leaderboard')!,
  lbList: document.querySelector('#lb-list')!,
  lbEmpty: document.querySelector('#lb-empty')!,
  gameover: document.querySelector('#gameover')!,
  overScore: document.querySelector('#over-score')!,
  overBest: document.querySelector('#over-best')!,
  overNew: document.querySelector('#over-new')!,
  pressMachine: document.querySelector<HTMLElement>('#press-machine')!,
  overflowFlash: document.querySelector('#overflow-flash')!,
  overflowFlashText: document.querySelector('#overflow-flash-text')!,
  objects: document.querySelector<HTMLDivElement>('#objects')!,
  ghostObj: document.querySelector<HTMLDivElement>('#ghost-obj')!,
  hintLayer: document.querySelector<HTMLDivElement>('#hint-layer')!,
  sparks: document.querySelector<HTMLCanvasElement>('#sparks')!,
  briquette: document.querySelector<HTMLElement>('#briquette')!,
  flyLayer: document.querySelector<HTMLElement>('#fly-layer')!,
  chamber: document.querySelector<HTMLElement>('#chamber')!,
  coach: document.querySelector<HTMLElement>('#coach')!,
  coachText: document.querySelector('#coach-text')!,
  trainBanner: document.querySelector('#train-banner')!,
  btnSettings: document.querySelector<HTMLButtonElement>('#btn-settings')!,
  settingsPopup: document.querySelector('#settings-popup')!,
  btnSettingsClose: document.querySelector<HTMLButtonElement>('#btn-settings-close')!,
  volMaster: document.querySelector<HTMLInputElement>('#vol-master')!,
  volMusic: document.querySelector<HTMLInputElement>('#vol-music')!,
  volSfx: document.querySelector<HTMLInputElement>('#vol-sfx')!,
  volMute: document.querySelector<HTMLInputElement>('#vol-mute')!,
}

type RunState = {
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
}

let meta: MetaState = loadMeta()
let phase: Phase = 'title'
let run: RunState
let toastTimer = 0
let flashTimer = 0
let gridCells: HTMLDivElement[][] = []
let builtSize = -1
let placeOrigin: { x: number; y: number } | null = null
/** False when ghost is shown but placement is illegal (red). */
let ghostValid = false
let wheelLock = false
let pressing = false
let dragging = false
let paused = false
let queueArmed = false

const TUTORIAL_LS_KEY = 'compactor_tutorial_done'

const TUTORIAL = [
  { text: '1. Select item from Queue', need: 'queue' as const, target: 'queue' },
  {
    text: '2. Place item in Chamber (Scroll/RMB to rotate)',
    need: 'place' as const,
    target: 'grid',
  },
  { text: '3. Hit SPACE to Crush!', need: 'press' as const, target: 'press' },
  {
    text: '4. OVERLOAD: scrap that won\'t fit = jam. 3 jams shut the station down — PRESS before it packs full! (SPACE)',
    need: 'ack' as const,
    target: 'danger',
  },
]

function isTutorialDone(): boolean {
  return localStorage.getItem(TUTORIAL_LS_KEY) === 'true' || meta.tutorialDone
}

function markTutorialDone(): void {
  localStorage.setItem(TUTORIAL_LS_KEY, 'true')
  meta.tutorialDone = true
  saveMeta(meta)
}

/** Prefer a valid covering origin; else best-effort origin for red ghost. */
function resolveGhostOrigin(
  cells: Array<[number, number]>,
  hx: number,
  hy: number,
): { origin: { x: number; y: number }; valid: boolean } {
  const valid = originCovering(cells, hx, hy)
  if (valid) return { origin: valid, valid: true }
  // Cover hovered cell with first piece cell (invalid preview)
  const [cx, cy] = cells[0] ?? [0, 0]
  return { origin: { x: hx - cx, y: hy - cy }, valid: false }
}

function originCovering(
  cells: Array<[number, number]>,
  hx: number,
  hy: number,
): { x: number; y: number } | null {
  for (const [cx, cy] of cells) {
    const ox = hx - cx
    const oy = hy - cy
    if (canPlace(run.grid, run.size, cells, ox, oy)) return { x: ox, y: oy }
  }
  if (canPlace(run.grid, run.size, cells, hx, hy)) return { x: hx, y: hy }
  return null
}

function setPhase(next: Phase): void {
  phase = next
  el.title.classList.toggle('hidden', next !== 'title')
  el.game.classList.toggle('hidden', next !== 'play' && next !== 'tutorial')
  if (next === 'tutorial' || next === 'play') el.game.classList.remove('hidden')
  if (next === 'title') {
    setDangerAmbience(0)
    hideCoach()
    rollFlavorQuote()
    playMenuMusic()
  }
}

function showToast(msg: string, ms = 1800): void {
  el.toast.textContent = msg
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    el.toast.textContent = ''
  }, ms)
}

function applyDangerVisual(n: number): void {
  for (const cls of ['danger-1', 'danger-2', 'danger-3', 'is-locked']) {
    el.pressMachine.classList.remove(cls)
    el.dangerPanel.classList.remove(cls)
  }
  if (n >= 1) {
    el.pressMachine.classList.add('danger-1')
    el.dangerPanel.classList.add('danger-1')
  }
  if (n >= 2) {
    el.pressMachine.classList.add('danger-2')
    el.dangerPanel.classList.add('danger-2')
  }
  if (n >= 3) {
    el.pressMachine.classList.add('danger-3', 'is-locked')
    el.dangerPanel.classList.add('danger-3')
  }
}

function flashOverflow(n: number): void {
  playOverloadAlarm()
  trackOverload(n)
  el.overflowFlashText.textContent = `Item jammed · stress ${n} / 3`
  el.overflowFlash.classList.remove('hidden')
  el.pressMachine.classList.add('is-overflow')
  applyDangerVisual(n)
  if (n >= 2) shakeStation(el.station, 220)
  if (n >= 3) burstSparks(el.sparks, 400)
  window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => {
    el.overflowFlash.classList.add('hidden')
    el.pressMachine.classList.remove('is-overflow')
  }, 900)
}

function refillQueue(): void {
  fillQueue(run.queue, meta, {
    tutorial: run.tutorial,
    tutIndex: run.tutIndex,
  })
  run.queue = sanitizeQueue(run.queue, meta)
  if (meta.autoSorter && !run.tutorial) run.queue = sortQueueByMaterial(run.queue)
}

/** FIFO conveyor after place/overflow: shift head, push unlocked item to tail. */
function advanceQueueAfterPlace(): void {
  onShapePlaced(run.queue, meta)
  run.queue = sanitizeQueue(run.queue, meta)
  if (meta.autoSorter && !run.tutorial) run.queue = sortQueueByMaterial(run.queue)
}

function current(): Piece {
  return run.queue[0]!
}

function hideCoach(): void {
  el.coach.classList.add('hidden')
  el.btnPress.classList.remove('coach-hot')
  el.dangerPanel.classList.remove('coach-hot')
}

function positionCoach(target: HTMLElement, text: string): void {
  el.coachText.textContent = text
  el.coach.classList.remove('hidden')
  const r = target.getBoundingClientRect()
  const top = Math.max(8, r.top - 72)
  const left = Math.min(window.innerWidth - 280, Math.max(8, r.left + r.width / 2 - 120))
  el.coach.style.top = `${top}px`
  el.coach.style.left = `${left}px`
}

function updateCoach(): void {
  if (!run?.tutorial || paused) {
    hideCoach()
    return
  }
  const step = TUTORIAL[run.tutIndex]
  if (!step) {
    hideCoach()
    return
  }
  el.btnPress.classList.toggle('coach-hot', step.target === 'press')
  el.dangerPanel.classList.toggle('coach-hot', step.target === 'danger')
  if (step.target === 'queue') {
    const slot = el.queue.querySelector('.queue-item.current') as HTMLElement | null
    positionCoach(slot ?? el.queueRail, step.text)
  } else if (step.target === 'grid') {
    positionCoach(el.chamber, step.text)
  } else if (step.target === 'danger') {
    positionCoach(el.dangerPanel, step.text)
  } else {
    positionCoach(el.btnPress, step.text)
  }
}

function advanceTutorial(from: 'queue' | 'place' | 'press' | 'ack'): void {
  if (!run.tutorial) return
  const step = TUTORIAL[run.tutIndex]
  if (!step || step.need !== from) return
  run.tutIndex += 1
  if (!TUTORIAL[run.tutIndex]) {
    completeTraining()
    renderAll()
    return
  }
  updateCoach()
  renderAll()
}

function completeTraining(): void {
  markTutorialDone()
  run.tutorial = false
  hideCoach()
  el.trainBanner.classList.remove('hidden')
  playSfx('alloy', { volume: 0.7 })
  trackTutorialDone()
  window.setTimeout(() => {
    el.trainBanner.classList.add('hidden')
    setPhase('play')
    showToast('GO FOR HIGH SCORE!')
  }, 2200)
}

function startRun(asTutorial: boolean): void {
  run = {
    grid: emptyGrid(meta.gridSize),
    size: meta.gridSize,
    queue: [],
    placements: [],
    overflow: 0,
    runScore: 0,
    ended: false,
    hover: null,
    tutorial: asTutorial,
    tutIndex: 0,
    pressCount: 0,
    pressesSinceLastDraft: 0,
    lastDraftAtCredits: meta.credits,
  }
  placeOrigin = null
  ghostValid = false
  builtSize = -1
  pressing = false
  paused = false
  queueArmed = !asTutorial
  applyDangerVisual(0)
  updateGridDimensions(meta.gridSize, meta.gridSize)
  refillQueue()
  el.gameover.classList.add('hidden')
  el.briquette.classList.add('hidden')
  el.draft.classList.add('hidden')
  el.trainBanner.classList.add('hidden')
  if (el.playerNickname) el.playerNickname.value = ''
  setPhase(asTutorial ? 'tutorial' : 'play')
  playGameMusic()
  trackRunStart(asTutorial)
  renderAll()
  updateCoach()
}

/** Zero balance + base upgrades; keeps best / leaderboard / tutorial flag. */
function wipeRunMeta(): void {
  const keep = {
    bestRun: meta.bestRun,
    bestBlock: meta.bestBlock,
    tutorialDone: meta.tutorialDone,
    leaderboard: meta.leaderboard,
  }
  meta = {
    ...DEFAULT_META,
    ...keep,
    credits: 0,
    gridSize: DEFAULT_META.gridSize,
    unlockedOrganic: false,
    unlockedElectronics: false,
    recipePlasticMetal: false,
    autoSorter: false,
    metalValueBonus: 0,
    densityBonusFactor: 0,
    queueSize: 3,
  }
  persist()
}

/** Full run wipe after Game Over / RESTART. */
function resetRunState(): void {
  wipeRunMeta()
  hideGameOverModal()
  // startRun zeros runScore / overflow / grid / queue and refreshes UI
  startRun(false)
}

function hideGameOverModal(): void {
  el.gameover.classList.add('hidden')
}

function saveScoreAndRestart(): void {
  const name =
    (el.playerNickname?.value || '').trim().toUpperCase().slice(0, 10) || 'OPERATOR'
  const finalScore = run?.runScore ?? 0
  pushLeaderboard(meta, finalScore, name)
  // Mirror TZ key for external tools
  try {
    const raw = localStorage.getItem('compactor_leaderboard')
    const list: Array<{ name: string; score: number; date: string }> = raw
      ? (JSON.parse(raw) as Array<{ name: string; score: number; date: string }>)
      : []
    list.push({
      name,
      score: finalScore,
      date: new Date().toLocaleDateString(),
    })
    list.sort((a, b) => b.score - a.score)
    localStorage.setItem('compactor_leaderboard', JSON.stringify(list.slice(0, 10)))
  } catch {
    /* ignore */
  }
  persist()
  playSfx('buy', { volume: 0.55 })
  resetRunState()
}

function enterFromTitle(): void {
  void unlockAudio()
  playSfx('start', { volume: 0.8 })
  wipeRunMeta()
  if (!isTutorialDone()) startRun(true)
  else startRun(false)
}

function persist(): void {
  saveMeta(meta)
}

function breakdown(): ScoreBreakdown {
  return scoreGrid(run.grid, run.size, meta)
}

function rotationsOf(piece: Piece): Array<Array<[number, number]>> {
  const out: Array<Array<[number, number]>> = []
  let cells = piece.cells.map((c) => [c[0], c[1]] as [number, number])
  for (let i = 0; i < 4; i++) {
    const key = cells.map((c) => c.join(',')).join('|')
    if (!out.some((o) => o.map((c) => c.join(',')).join('|') === key)) {
      out.push(cells.map((c) => [c[0], c[1]] as [number, number]))
    }
    cells = rotateCells(cells)
  }
  return out
}

function pieceFitsAnywhere(piece: Piece): boolean {
  for (const cells of rotationsOf(piece)) {
    if (findAnyPlacement(run.grid, run.size, cells)) return true
  }
  return false
}

function itemSprite(itemId: string, rot: number): string {
  return assetUrl(`pixel/item-${itemId}-r${((rot % 4) + 4) % 4}.png`)
}

function blocked(): boolean {
  return !run || run.ended || pressing || paused || phase === 'title'
}

function rotateCurrent(): void {
  if (blocked()) return
  if (run.tutorial && TUTORIAL[run.tutIndex]?.need === 'queue') return
  const p = current()
  p.cells = rotateCells(p.cells)
  p.rot = (p.rot + 1) % 4
  playSfx('rotate', { volume: 0.55, rate: 0.95 + Math.random() * 0.12 })
  if (run.hover) {
    const g = resolveGhostOrigin(p.cells, run.hover.x, run.hover.y)
    placeOrigin = g.origin
    ghostValid = g.valid
  } else {
    placeOrigin = null
    ghostValid = false
  }
  renderAll()
  updateCoach()
}

function tryPlace(ox: number, oy: number): void {
  if (blocked()) return
  if (run.tutorial && TUTORIAL[run.tutIndex]?.need === 'queue') {
    showToast('Click the Queue item first')
    return
  }
  if (run.tutorial && TUTORIAL[run.tutIndex]?.need === 'press') return
  if (run.tutorial && TUTORIAL[run.tutIndex]?.need === 'place' && !queueArmed) {
    showToast('Click the Queue item first')
    return
  }

  const p = current()
  if (!canPlace(run.grid, run.size, p.cells, ox, oy)) {
    playSfx('deny', { volume: 0.45 })
    showToast("Won't fit")
    return
  }
  const prev = breakdown().value
  const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const abs = placePiece(run.grid, p.cells, ox, oy, p.material, p.itemId, id)
  run.placements.push({
    id,
    itemId: p.itemId,
    material: p.material,
    cells: abs,
    rot: p.rot,
  })
  playPlace(p.material === 'metal')
  trackPlace()
  run.hover = null
  placeOrigin = null
  ghostValid = false
  advanceQueueAfterPlace()
  ensurePlaceableOrOverflow()
  const next = breakdown().value
  renderAll()
  flashDelta(next - prev)
  advanceTutorial('place')
  updateCoach()
}

function ensurePlaceableOrOverflow(): void {
  if (run.ended || run.tutorial) return
  const p = current()
  if (pieceFitsAnywhere(p)) return

  run.overflow += 1
  const id = `p-${Date.now()}-ovf`
  const abs = forcePlace(run.grid, run.size, p.cells, p.material, p.itemId, id)
  run.placements = run.placements.filter((pl) =>
    pl.cells.some(([x, y]) => {
      const c = run.grid[y]![x]
      return c && c.placementId === pl.id
    }),
  )
  run.placements.push({
    id,
    itemId: p.itemId,
    material: p.material,
    cells: abs,
    rot: p.rot,
  })
  advanceQueueAfterPlace()
  flashOverflow(run.overflow)
  showToast(`OVERLOAD ${run.overflow}/3`, 2000)

  if (run.overflow >= 3) {
    endRun()
    return
  }
  if (!pieceFitsAnywhere(current())) ensurePlaceableOrOverflow()
}

function flashDelta(delta: number): void {
  if (!delta) {
    el.valueDelta.textContent = ''
    el.valueDelta.className = 'value-delta'
    return
  }
  const text = delta > 0 ? `+$${delta}` : `-$${Math.abs(delta)}`
  el.valueDelta.textContent = text
  el.valueDelta.className = `value-delta ${delta > 0 ? 'up' : 'down'}`
  window.setTimeout(() => {
    if (el.valueDelta.textContent === text) el.valueDelta.textContent = ''
  }, 1200)
}

function openDraft(): void {
  paused = true
  hideCoach()
  run.pressesSinceLastDraft = 0
  const options = pickDraftOptions(meta, 3)
  el.draftCards.replaceChildren()
  for (const item of options) {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'draft-card'
    card.innerHTML = `
      <h3>${item.title}</h3>
      <p>${item.desc}</p>
      <span class="cost">${item.type.toUpperCase()}</span>
    `
    card.addEventListener('click', () => pickDraft(item))
    el.draftCards.appendChild(card)
  }
  el.draft.classList.remove('hidden')
  playSfx('ui', { volume: 0.55 })
}

function pickDraft(item: ShopItem): void {
  const prevSize = meta.gridSize
  if (!item.canBuy(meta) && item.id !== 'clear_overload') {
    playSfx('deny', { volume: 0.4 })
    return
  }

  item.apply(meta)

  if (item.id === 'clear_overload' && run && !run.ended) {
    run.overflow = Math.max(0, run.overflow - 1)
  }

  persist()
  playSfx('buy', { volume: 0.7 })
  trackUpgrade(item.id)
  if (meta.gridSize !== prevSize && !run.ended) {
    const next = emptyGrid(meta.gridSize)
    for (let y = 0; y < run.size; y++) {
      for (let x = 0; x < run.size; x++) next[y]![x] = run.grid[y]![x]
    }
    run.grid = next
    run.size = meta.gridSize
    builtSize = -1
    updateGridDimensions(run.size, run.size)
  }
  refillQueue()
  run.lastDraftAtCredits = meta.credits
  run.pressesSinceLastDraft = 0
  el.draft.classList.add('hidden')
  paused = false
  showToast(`Upgrade: ${item.title}`)
  renderAll()
  updateCoach()
}

function maybeOpenDraft(): void {
  if (run.tutorial || run.ended || paused) return
  if (run.pressesSinceLastDraft >= 3) {
    openDraft()
    return
  }
  const creditMilestone =
    Math.floor(meta.credits / 100) > Math.floor(run.lastDraftAtCredits / 100)
  if (creditMilestone) openDraft()
}

function doPress(): void {
  if (blocked()) return
  if (run.tutorial && TUTORIAL[run.tutIndex]?.need === 'ack') {
    advanceTutorial('ack')
    return
  }
  if (run.tutorial && TUTORIAL[run.tutIndex]?.need !== 'press') {
    showToast('Place scrap first')
    return
  }
  const s = breakdown()
  if (s.occupied === 0) {
    playSfx('deny', { volume: 0.4 })
    showToast('Chamber empty')
    return
  }

  pressing = true
  playPress(s.alloyMult, { value: s.value, density: s.density })
  trackPress(s.value)
  el.pressMachine.classList.add('is-pressing')
  el.btnPress.classList.add('is-slam')
  shakeStation(el.station, 200)
  burstSparks(el.sparks, 320)

  window.setTimeout(() => {
    el.pressMachine.classList.remove('is-pressing')
    el.btnPress.classList.remove('is-slam')

    run.runScore += s.value
    meta.credits += s.value
    if (s.value > meta.bestBlock) meta.bestBlock = s.value
    persist()

    flyCash(el.flyLayer, el.prevValue as HTMLElement, el.credits as HTMLElement, s.value)
    showBriquette(el.briquette)

    run.grid = emptyGrid(run.size)
    run.placements = []
    run.pressCount += 1
    run.pressesSinceLastDraft += 1
    pressing = false
    showToast(`+$${s.value}`, 1400)

    if (run.tutorial && TUTORIAL[run.tutIndex]?.need === 'press') {
      advanceTutorial('press')
      return
    }

    renderAll()
    maybeOpenDraft()
  }, 240)
}

function endRun(): void {
  run.ended = true
  applyDangerVisual(3)
  const isNew = run.runScore > meta.bestRun
  if (isNew) meta.bestRun = run.runScore
  persist()

  playSfx('gameover', { volume: 0.85 })
  burstSparks(el.sparks, 450)
  shakeStation(el.station, 280)
  el.overScore.textContent = formatMoney(run.runScore)
  el.overBest.textContent = formatMoney(meta.bestRun)
  el.overNew.classList.toggle('hidden', !isNew)
  if (el.playerNickname) {
    el.playerNickname.value = ''
    window.setTimeout(() => el.playerNickname.focus(), 50)
  }
  el.gameover.classList.remove('hidden')
  hideCoach()
  renderHud()
  playMenuMusic()
  trackGameOver(run.runScore)
}

function armQueueFromTutorial(): void {
  if (!run.tutorial) return
  if (TUTORIAL[run.tutIndex]?.need !== 'queue') return
  queueArmed = true
  playSfx('ui', { volume: 0.45 })
  advanceTutorial('queue')
}

function renderQueue(): void {
  el.queue.replaceChildren()
  run.queue.forEach((p, i) => {
    const wrap = document.createElement('div')
    wrap.className = `queue-item mat-${p.material}${i === 0 ? ' current' : ''}`
    if (i === 0) {
      wrap.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || blocked()) return
        if (run.tutorial && TUTORIAL[run.tutIndex]?.need === 'queue') {
          armQueueFromTutorial()
          return
        }
        if (run.tutorial && TUTORIAL[run.tutIndex]?.need === 'place') queueArmed = true
        dragging = true
        wrap.setPointerCapture(e.pointerId)
      })
    }
    const img = document.createElement('img')
    img.className = 'item-icon'
    img.src = itemSprite(p.itemId, p.rot)
    img.alt = p.itemName
    img.width = 64
    img.height = 64
    img.draggable = false
    const tag = document.createElement('div')
    tag.className = 'tag item-name'
    tag.textContent = p.itemName
    const mat = document.createElement('div')
    mat.className = 'mat item-category'
    mat.textContent = MATERIAL_META[p.material].name
    wrap.append(img, tag, mat)
    el.queue.appendChild(wrap)
  })
}

function renderOverflow(): void {
  el.overflow.replaceChildren()
  for (let i = 0; i < 3; i++) {
    const pip = document.createElement('div')
    const on = i < run.overflow
    pip.className = `pip${on ? ` on level-${i + 1} lit` : ''}`
    if (on && i === run.overflow - 1) {
      pip.classList.remove('lit')
      pip.classList.add('blink-twice')
      window.setTimeout(() => {
        pip.classList.remove('blink-twice')
        pip.classList.add('lit')
      }, 520)
    }
    el.overflow.appendChild(pip)
  }
  const labels = ['NORMAL', 'WARNING', 'CRITICAL', 'FAILURE']
  el.overflowText.textContent = labels[Math.min(3, run.overflow)] ?? 'NORMAL'
  applyDangerVisual(run.overflow)
}

function setHoverCell(x: number, y: number): void {
  if (blocked()) return
  run.hover = { x, y }
  const g = resolveGhostOrigin(current().cells, x, y)
  placeOrigin = g.origin
  ghostValid = g.valid
  paintGrid()
  renderPreview()
}

function clearHover(): void {
  if (!run.hover && !placeOrigin) return
  run.hover = null
  placeOrigin = null
  ghostValid = false
  paintGrid()
  renderPreview()
}

function updateGridDimensions(rows: number, cols: number): void {
  const grid = el.grid
  document.documentElement.style.setProperty('--grid-n', String(cols))
  document.documentElement.style.setProperty('--cols', String(cols))
  document.documentElement.style.setProperty('--rows', String(rows))
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`
  grid.style.width = '100%'
  grid.style.height = '100%'
}

function ensureGridDom(size: number): void {
  if (builtSize === size && gridCells.length === size) {
    updateGridDimensions(size, size)
    return
  }
  builtSize = size
  gridCells = []
  updateGridDimensions(size, size)
  el.grid.replaceChildren()

  for (let y = 0; y < size; y++) {
    const row: HTMLDivElement[] = []
    for (let x = 0; x < size; x++) {
      const cell = document.createElement('div')
      cell.className = 'cell'
      cell.addEventListener('pointerenter', () => setHoverCell(x, y))
      let armed = false
      const placeHere = () => {
        if (blocked() || armed) return
        armed = true
        window.setTimeout(() => {
          armed = false
        }, 120)
        const origin = originCovering(current().cells, x, y)
        if (!origin) {
          playSfx('deny', { volume: 0.35 })
          showToast("Won't fit")
          return
        }
        tryPlace(origin.x, origin.y)
      }
      cell.addEventListener('pointerdown', (e) => {
        if (e.button === 2) {
          e.preventDefault()
          rotateCurrent()
          return
        }
        if (e.button !== 0) return
        e.preventDefault()
        placeHere()
      })
      // No separate click handler — pointerdown+click was double-firing deny/place SFX.
      cell.addEventListener('contextmenu', (e) => e.preventDefault())
      el.grid.appendChild(cell)
      row.push(cell)
    }
    gridCells.push(row)
  }
}

/** Layout px per cell (ignores parent transform:scale). */
function cellPx(): number {
  const n = run?.size || 5
  const w = el.grid.clientWidth || 420
  return w / n
}

function bboxOf(cells: Array<[number, number]>): { x: number; y: number; w: number; h: number } {
  const xs = cells.map((c) => c[0])
  const ys = cells.map((c) => c[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return {
    x: minX,
    y: minY,
    w: Math.max(...xs) - minX + 1,
    h: Math.max(...ys) - minY + 1,
  }
}

function renderObjects(): void {
  el.objects.replaceChildren()
  const size = cellPx()
  for (const pl of run.placements) {
    const box = bboxOf(pl.cells)
    const img = document.createElement('img')
    img.className = `obj-sprite mat-${pl.material}`
    img.src = itemSprite(pl.itemId, pl.rot)
    img.alt = ''
    img.style.left = `${box.x * size}px`
    img.style.top = `${box.y * size}px`
    img.style.width = `${box.w * size}px`
    img.style.height = `${box.h * size}px`
    el.objects.appendChild(img)
  }
}

function renderGhostObject(): void {
  el.ghostObj.replaceChildren()
  el.hintLayer.replaceChildren()
  if (!placeOrigin || run.ended) {
    el.ghostObj.classList.add('hidden')
    return
  }
  const p = current()
  const abs = p.cells.map(([cx, cy]) => [placeOrigin!.x + cx, placeOrigin!.y + cy] as [number, number])
  const box = bboxOf(abs)
  const size = cellPx()
  const img = document.createElement('img')
  img.src = itemSprite(p.itemId, p.rot)
  img.className = `mat-${p.material}`
  img.alt = ''
  img.style.left = `${box.x * size}px`
  img.style.top = `${box.y * size}px`
  img.style.width = `${box.w * size}px`
  img.style.height = `${box.h * size}px`
  img.style.opacity = ghostValid ? '0.55' : '0.4'
  img.style.filter = ghostValid
    ? 'none'
    : 'drop-shadow(0 0 0 #ff3232) sepia(1) saturate(8) hue-rotate(-50deg)'
  el.ghostObj.appendChild(img)
  el.ghostObj.classList.remove('hidden')

  if (!ghostValid) return

  const hints = ghostContactHints(
    run.grid,
    run.size,
    p.cells,
    placeOrigin.x,
    placeOrigin.y,
    p.material,
    meta,
  )
  const shown = new Set<string>()
  for (const h of hints) {
    const key = `${h.x},${h.y},${h.kind}`
    if (shown.has(key)) continue
    shown.add(key)
    const chip = document.createElement('div')
    chip.className = `hint-chip ${h.kind}`
    chip.textContent = h.kind === 'good' ? '+$$' : '!'
    chip.style.left = `${h.x * size + size * 0.15}px`
    chip.style.top = `${h.y * size + size * 0.15}px`
    el.hintLayer.appendChild(chip)
  }
}

function paintGrid(): void {
  const size = run.size
  ensureGridDom(size)
  const p = current()
  const origin = placeOrigin
  const ghost = new Set(
    origin ? p.cells.map(([cx, cy]) => `${origin.x + cx},${origin.y + cy}`) : [],
  )
  const hints =
    origin && ghostValid
      ? ghostContactHints(run.grid, run.size, p.cells, origin.x, origin.y, p.material, meta)
      : []
  const hintMap = new Map(hints.map((h) => [`${h.x},${h.y}`, h.kind]))

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = gridCells[y]![x]!
      cell.className = 'cell'
      const filled = run.grid[y]![x]
      const isGhost = ghost.has(`${x},${y}`)
      if (filled) {
        cell.classList.add('filled')
        if (isGhost && !ghostValid) cell.classList.add('ghost-bad')
        const hk = hintMap.get(`${x},${y}`)
        if (hk === 'good') cell.classList.add('hint-good')
        if (hk === 'bad') cell.classList.add('hint-bad')
        continue
      }
      if (isGhost) cell.classList.add(ghostValid ? 'ghost-ok' : 'ghost-bad')
    }
  }
  renderObjects()
  renderGhostObject()
}

function renderGrid(): void {
  paintGrid()
}

function renderPreview(): void {
  const base = breakdown()
  let display = base
  let delta = 0

  if (placeOrigin && ghostValid && !run.ended) {
    const p = current()
    display = previewScoreWithGhost(
      run.grid,
      run.size,
      p.cells,
      placeOrigin.x,
      placeOrigin.y,
      p.material,
      meta,
    )
    delta = display.value - base.value
  }

  el.prevDensity.textContent = `${Math.round(display.density * 100)}%`
  el.prevBase.textContent = String(display.base)
  el.prevPenalty.textContent = String(display.penalty)
  el.prevAlloy.textContent = `×${display.alloyMult.toFixed(2)}`
  el.prevValue.textContent = formatMoney(display.value)

  const band = densityBand(display.density)
  el.densityLabel.textContent = band.label
  el.manoStatus.textContent = band.label
  el.manoPct.textContent = `${Math.round(display.density * 100)}%`
  el.manoNeedle.style.transform = `rotate(${densityToNeedleDeg(display.density)}deg)`

  if (placeOrigin) {
    if (delta > 0) {
      el.valueDelta.textContent = `+$${delta}`
      el.valueDelta.className = 'value-delta up'
    } else if (delta < 0) {
      el.valueDelta.textContent = `-$${Math.abs(delta)}`
      el.valueDelta.className = 'value-delta down'
    } else {
      el.valueDelta.textContent = ''
      el.valueDelta.className = 'value-delta'
    }
  }

  el.btnPress.disabled = blocked() || base.occupied === 0
}

function renderHud(): void {
  el.credits.textContent = formatMoney(meta.credits)
  el.runScore.textContent = formatMoney(run?.runScore ?? 0)
  el.bestRun.textContent = formatMoney(meta.bestRun)
  el.bestBlock.textContent = String(meta.bestBlock)
}

function renderLegend(): void {
  el.legend.replaceChildren()
}

function renderLeaderboard(): void {
  el.lbList.replaceChildren()
  const activeScores = meta.leaderboard.filter((entry) => entry.score > 0)
  el.lbEmpty.classList.toggle('hidden', activeScores.length > 0)
  const medalPrefix = ['👑 #1', '🥈 #2', '🥉 #3'] as const
  activeScores.forEach((entry, i) => {
    const li = document.createElement('li')
    li.className = 'leaderboard-row'
    if (i === 0) li.classList.add('rank-gold')
    else if (i === 1) li.classList.add('rank-silver')
    else if (i === 2) li.classList.add('rank-bronze')
    const rankLabel = medalPrefix[i] ?? `#${i + 1}`
    li.innerHTML = `<span class="rank-num">${rankLabel}</span><span class="lb-name">${entry.name}</span><span class="score-val">${formatMoney(entry.score)}</span>`
    el.lbList.appendChild(li)
  })
}

function openLb(): void {
  renderLeaderboard()
  el.leaderboard.classList.remove('hidden')
}

function renderAll(): void {
  if (!run) return
  renderHud()
  renderQueue()
  renderOverflow()
  renderGrid()
  renderPreview()
  renderLegend()
  updateCoach()
}

function cellFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
  if (!run) return null
  const rect = el.grid.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const clickX = clientX - rect.left
  const clickY = clientY - rect.top
  const cols = run.size
  const rows = run.size

  // Strict normalize — works for any chamber size / CSS scale
  const col = Math.floor((clickX / rect.width) * cols)
  const row = Math.floor((clickY / rect.height) * rows)

  if (row < 0 || row >= rows || col < 0 || col >= cols) return null
  return { x: col, y: row }
}

function syncAudioUi(): void {
  const s = getAudioSettings()
  el.volMaster.value = String(Math.round(s.master * 100))
  el.volMusic.value = String(Math.round(s.music * 100))
  el.volSfx.value = String(Math.round(s.sfx * 100))
  el.volMute.checked = s.muted
}

el.grid.addEventListener('pointerleave', (e) => {
  const next = e.relatedTarget
  if (next instanceof Node && el.grid.contains(next)) return
  if (!dragging) clearHover()
})

el.grid.addEventListener('mousemove', (e) => {
  if (blocked()) return
  const cell = cellFromClient(e.clientX, e.clientY)
  if (cell) setHoverCell(cell.x, cell.y)
  else clearHover()
})

el.grid.addEventListener('mouseleave', () => {
  if (!dragging) clearHover()
})

el.grid.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  rotateCurrent()
})

el.grid.addEventListener(
  'wheel',
  (e) => {
    if (phase === 'title' || run?.ended || paused) return
    e.preventDefault()
    if (wheelLock) return
    wheelLock = true
    rotateCurrent()
    window.setTimeout(() => {
      wheelLock = false
    }, 120)
  },
  { passive: false },
)

window.addEventListener('pointermove', (e) => {
  if (!dragging || blocked()) return
  const cell = cellFromClient(e.clientX, e.clientY)
  if (cell) setHoverCell(cell.x, cell.y)
})

window.addEventListener('pointerup', (e) => {
  if (!dragging) return
  dragging = false
  if (blocked()) return
  const cell = cellFromClient(e.clientX, e.clientY)
  if (!cell) {
    clearHover()
    return
  }
  const origin = originCovering(current().cells, cell.x, cell.y)
  if (origin) tryPlace(origin.x, origin.y)
  else {
    playSfx('deny', { volume: 0.35 })
    showToast("Won't fit")
  }
})

el.btnRotate.addEventListener('click', () => {
  void unlockAudio()
  rotateCurrent()
})
el.btnPress.addEventListener('click', () => {
  void unlockAudio()
  doPress()
})
el.dangerPanel.addEventListener('click', () => {
  if (!run?.tutorial || TUTORIAL[run.tutIndex]?.need !== 'ack') return
  void unlockAudio()
  playSfx('ui', { volume: 0.45 })
  advanceTutorial('ack')
})
el.btnLb.addEventListener('click', () => {
  void unlockAudio()
  playSfx('ui', { volume: 0.5 })
  openLb()
})
el.btnTitleLb.addEventListener('click', () => {
  void unlockAudio()
  playSfx('ui', { volume: 0.5 })
  openLb()
})
el.btnLbClose.addEventListener('click', () => {
  playSfx('ui', { volume: 0.4 })
  el.leaderboard.classList.add('hidden')
})
el.leaderboard.addEventListener('click', (e) => {
  if (e.target === el.leaderboard) el.leaderboard.classList.add('hidden')
})
el.btnSaveScore.addEventListener('click', () => {
  void unlockAudio()
  saveScoreAndRestart()
})
el.playerNickname.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    saveScoreAndRestart()
  }
})
el.btnOverMenu.addEventListener('click', () => {
  playSfx('ui', { volume: 0.45 })
  hideGameOverModal()
  wipeRunMeta()
  setDangerAmbience(0)
  setPhase('title')
})
el.btnTutSkip.addEventListener('click', () => {
  markTutorialDone()
  startRun(false)
})

el.btnSettings.addEventListener('click', () => {
  el.settingsPopup.classList.toggle('hidden')
})
el.btnSettingsClose.addEventListener('click', () => {
  el.settingsPopup.classList.add('hidden')
})
el.volMaster.addEventListener('input', () => {
  setAudioSettings({ master: Number(el.volMaster.value) / 100 })
})
el.volMusic.addEventListener('input', () => {
  setAudioSettings({ music: Number(el.volMusic.value) / 100 })
})
el.volSfx.addEventListener('input', () => {
  setAudioSettings({ sfx: Number(el.volSfx.value) / 100 })
})
el.volMute.addEventListener('change', () => {
  setAudioSettings({ muted: el.volMute.checked })
})

window.addEventListener(
  'pointerdown',
  () => {
    void unlockAudio()
  },
  { once: true },
)

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    el.leaderboard.classList.add('hidden')
    return
  }

  if (phase === 'title') {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      enterFromTitle()
    }
    return
  }

  if (paused) return
  if (run?.ended) return
  if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
    e.preventDefault()
    rotateCurrent()
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    doPress()
  }
})

window.addEventListener('resize', () => {
  resizeGame()
  updateCoach()
})

/** Letterbox-scale the 1280×800 virtual frame to the viewport. */
function resizeGame(): void {
  if ((window as unknown as { __promoLockScale?: boolean }).__promoLockScale) return
  const wrapper = document.getElementById('game-wrapper')
  if (!wrapper) return
  const targetWidth = 1280
  const targetHeight = 800
  const scaleX = window.innerWidth / targetWidth
  const scaleY = window.innerHeight / targetHeight
  const scale = Math.min(scaleX, scaleY) * 0.95
  wrapper.style.transform = `scale(${scale})`
}

window.addEventListener('DOMContentLoaded', () => {
  resizeGame()
  mountIndustrialWarp()
  runBootSequence()
})
resizeGame()
// Early mount so first paint isn't empty; remounted again after layout.
mountIndustrialWarp()

const FLAVOR_QUOTES = [
  '"PRESS HARD. THINK LATER."',
  '"WARNING: DO NOT CRUSH EXPLOSIVES"',
  '"RECYCLING STATION #04 — OSHA APPROVED"',
  '"GOBLINS IN CHAMBER VOID WARRANTY"',
  '"PACK IT TIGHT BEFORE OVERFLOW"',
]

function rollFlavorQuote(): void {
  const quoteEl = document.getElementById('flavor-quote')
  if (!quoteEl) return
  quoteEl.textContent = FLAVOR_QUOTES[Math.floor(Math.random() * FLAVOR_QUOTES.length)]!
}

/** SCRAPYARD OS boot splash before title menu. */
function runBootSequence(): void {
  const logEl = document.getElementById('boot-log')
  const powerBtn = document.getElementById('btn-power-on')
  const bootOverlay = document.getElementById('boot-screen')
  if (!logEl || !powerBtn) return

  const logs = [
    'MEM CHECK: 640K OK',
    'LOADING HYDRAULIC SHADERS... OK',
    'INITIALIZING PRESS CHAMBER... OK',
    'LOADING TRASH DATABASE... OK',
    'AUDIO ENGINE READY.',
  ]

  let step = 0
  const interval = window.setInterval(() => {
    if (step < logs.length) {
      logEl.textContent += `> ${logs[step]}\n`
      step += 1
      return
    }
    window.clearInterval(interval)
    powerBtn.classList.remove('hidden')
  }, 250)

  powerBtn.addEventListener('click', () => {
    void unlockAudio()
    void initAnalytics().then(() => trackPowerOn())
    playSfx('start', { volume: 0.55 })
    playMenuMusic()
    bootOverlay?.classList.add('fade-out')
    window.setTimeout(() => {
      bootOverlay?.remove()
    }, 500)
  })
}

void pieceBounds

syncAudioUi()
void preloadSfx()
setPhase('title')
renderHud()
resizeGame()
/** Promo capture API — Playwright uses ?promo=1 */
if (new URLSearchParams(location.search).has('promo')) {
  installPromoApi({
    el: {
      title: el.title,
      game: el.game,
      draft: el.draft,
      draftCards: el.draftCards,
      leaderboard: el.leaderboard,
      gameover: el.gameover,
      toast: el.toast,
      btnPress: el.btnPress,
    },
    getMeta: () => meta,
    setMeta: (m) => {
      meta = m
    },
    getRun: () => run,
    setRun: (r) => {
      run = r
    },
    setPlaceOrigin: (o) => {
      placeOrigin = o
    },
    setGhostValid: (v) => {
      ghostValid = v
    },
    setPaused: (v) => {
      paused = v
    },
    setQueueArmed: (v) => {
      queueArmed = v
    },
    setPhase,
    startRun,
    persist,
    renderAll,
    openLb,
    doPress,
    rotateCurrent,
    tryPlace,
    pickDraft,
    showToast,
    setAudioMuted: (muted) => {
      setAudioSettings({ muted })
      syncAudioUi()
    },
    stopMusic,
    DEFAULT_META,
  })
  window.setTimeout(() => {
    document.getElementById('boot-screen')?.remove()
    document.body.classList.add('promo-capture')
    const promo = (window as unknown as { __PROMO?: { mute: () => void; lockScale: () => void } })
      .__PROMO
    promo?.mute()
    promo?.lockScale()
  }, 50)
}

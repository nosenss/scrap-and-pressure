import { assetUrl } from './assets'

export type SfxId =
  | 'press'
  | 'lever'
  | 'alloy'
  | 'overflow'
  | 'place'
  | 'rotate'
  | 'deny'
  | 'ui'
  | 'buy'
  | 'gameover'
  | 'start'
  | 'metal'

const FILES: Record<SfxId, string> = {
  press: assetUrl('sfx/press.ogg'),
  lever: assetUrl('sfx/lever.ogg'),
  alloy: assetUrl('sfx/alloy.ogg'),
  overflow: assetUrl('sfx/overflow.ogg'),
  place: assetUrl('sfx/place_soft.ogg'),
  rotate: assetUrl('sfx/rotate.ogg'),
  deny: assetUrl('sfx/deny.ogg'),
  ui: assetUrl('sfx/ui.ogg'),
  buy: assetUrl('sfx/buy.ogg'),
  gameover: assetUrl('sfx/gameover.ogg'),
  start: assetUrl('sfx/start.ogg'),
  metal: assetUrl('sfx/rotate.ogg'),
}


/** Sci-fi UI leftovers — keep muted; place is re-enabled soft. */
const MUTED_SFX: ReadonlySet<SfxId> = new Set(['deny', 'overflow', 'alloy', 'buy'])

const AUDIO_KEY = 'scrap-pressure-audio-v1'

export type AudioSettings = {
  master: number
  music: number
  sfx: number
  muted: boolean
}

type PlayOpts = {
  volume?: number
  rate?: number
}

let ctx: AudioContext | null = null
const buffers = new Map<SfxId, AudioBuffer>()
let loadPromise: Promise<void> | null = null
let settings: AudioSettings = loadAudioSettings()

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(AUDIO_KEY)
    if (!raw) return { master: 0.85, music: 0.7, sfx: 1, muted: false }
    const p = JSON.parse(raw) as Partial<AudioSettings>
    return {
      master: typeof p.master === 'number' ? clamp01(p.master) : 0.85,
      music: typeof p.music === 'number' ? clamp01(p.music) : 0.7,
      sfx: typeof p.sfx === 'number' ? clamp01(p.sfx) : 1,
      muted: !!p.muted,
    }
  } catch {
    return { master: 0.85, music: 0.7, sfx: 1, muted: false }
  }
}

export function getAudioSettings(): AudioSettings {
  return { ...settings }
}

export function setAudioSettings(partial: Partial<AudioSettings>): AudioSettings {
  settings = {
    master: partial.master !== undefined ? clamp01(partial.master) : settings.master,
    music: partial.music !== undefined ? clamp01(partial.music) : settings.music,
    sfx: partial.sfx !== undefined ? clamp01(partial.sfx) : settings.sfx,
    muted: partial.muted !== undefined ? partial.muted : settings.muted,
  }
  localStorage.setItem(AUDIO_KEY, JSON.stringify(settings))
  applyMusicGain()
  return getAudioSettings()
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function mixVolume(base: number): number {
  if (settings.muted) return 0
  return clamp01(base * settings.master * settings.sfx)
}

/** Effective music level: master × music (0 when muted). */
export function musicMixVolume(base = 1): number {
  if (settings.muted) return 0
  return clamp01(base * settings.master * settings.music)
}

/** Alias used by BGM helpers. */
export function getMusicVolume(): number {
  return musicMixVolume()
}

function applyMusicGain(): void {
  if (musicEl) musicEl.volume = musicMixVolume()
}

/** In-run playlist: groove → tension → outro → intro, then loop. */
const GAME_PLAYLIST = [
  assetUrl('sfx/track_part02_groove.ogg'),
  assetUrl('sfx/track_part03_tension.ogg'),
  assetUrl('sfx/track_part04_outro_loop.ogg'),
  assetUrl('sfx/track_part01_intro.ogg'),
] as const

const MENU_TRACK = assetUrl('sfx/track_part01_intro.ogg')

/** Music output element — volume follows Music / Master / Mute. */
let musicEl: HTMLAudioElement | null = null
let currentGameTrackIndex = 0
let isMenuMode = true
let onTrackEnded: (() => void) | null = null

function detachMusic(): void {
  if (musicEl && onTrackEnded) {
    musicEl.removeEventListener('ended', onTrackEnded)
  }
  onTrackEnded = null
  if (!musicEl) return
  musicEl.pause()
  musicEl.src = ''
  musicEl = null
}

export function stopMusic(): void {
  detachMusic()
}

/** Title / boot: loop intro only. */
export function playMenuMusic(): void {
  isMenuMode = true
  detachMusic()
  void unlockAudio().then(() => {
    if (!isMenuMode) return
    const el = new Audio(MENU_TRACK)
    el.loop = true
    el.volume = getMusicVolume()
    musicEl = el
    void el.play().catch(() => {})
  })
}

/** Run: chain through GAME_PLAYLIST, no per-track loop. */
export function playGameMusic(): void {
  isMenuMode = false
  detachMusic()
  currentGameTrackIndex = 0
  void unlockAudio().then(() => {
    if (isMenuMode) return
    playGameTrack(0)
  })
}

function playGameTrack(index: number): void {
  if (isMenuMode) return
  detachMusic()
  currentGameTrackIndex = index
  const src = GAME_PLAYLIST[currentGameTrackIndex]
  if (!src) return

  const el = new Audio(src)
  el.loop = false
  el.volume = getMusicVolume()
  onTrackEnded = () => {
    if (isMenuMode) return
    const nextIndex = (currentGameTrackIndex + 1) % GAME_PLAYLIST.length
    playGameTrack(nextIndex)
  }
  el.addEventListener('ended', onTrackEnded)
  musicEl = el
  void el.play().catch(() => {})
}

/** @deprecated use playMenuMusic / playGameMusic */
export async function playMusic(src: string, opts: { loop?: boolean; volume?: number } = {}): Promise<void> {
  isMenuMode = true
  detachMusic()
  await unlockAudio()
  const el = new Audio(src)
  el.loop = opts.loop !== false
  el.volume = musicMixVolume(opts.volume ?? 1)
  musicEl = el
  try {
    await el.play()
  } catch {
    /* autoplay / missing file */
  }
}

async function decode(id: SfxId): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(FILES[id], { cache: 'no-store' })
    if (!res.ok) return null
    const raw = await res.arrayBuffer()
    return await getCtx().decodeAudioData(raw.slice(0))
  } catch {
    return null
  }
}

export function preloadSfx(force = false): Promise<void> {
  if (force) {
    loadPromise = null
    buffers.clear()
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      getCtx()
      await Promise.all(
        (Object.keys(FILES) as SfxId[]).map(async (id) => {
          const buf = await decode(id)
          if (buf) buffers.set(id, buf)
        }),
      )
    })()
  }
  return loadPromise
}

export async function unlockAudio(): Promise<void> {
  const c = getCtx()
  if (c.state === 'suspended') await c.resume()
  // Force-reload buffers so swapped SFX (alloy/overflow) aren't stuck in memory
  void preloadSfx(true)
}

export function playSfx(id: SfxId, opts: PlayOpts = {}): void {
  if (MUTED_SFX.has(id)) return
  const vol = mixVolume(opts.volume ?? 0.85)
  if (vol <= 0.001) return
  const buf = buffers.get(id)
  if (!buf) {
    const a = new Audio(FILES[id])
    a.volume = vol
    a.playbackRate = opts.rate ?? 1
    void a.play().catch(() => {})
    void preloadSfx()
    return
  }

  const c = getCtx()
  if (c.state === 'suspended') void c.resume()

  const src = c.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = opts.rate ?? 1
  const gain = c.createGain()
  gain.gain.value = vol
  src.connect(gain)
  gain.connect(c.destination)
  src.start()
}

export function playPress(
  alloyMult: number,
  opts: { value?: number; density?: number } = {},
): void {
  const value = opts.value ?? 0
  const density = opts.density ?? 0
  const weight = Math.min(1, value / 400 + density * 0.45)
  const rate = 1.05 - weight * 0.35
  playSfx('lever', { volume: 0.5, rate: 0.9 })
  playSfx('press', { volume: 0.95, rate })
  if (alloyMult >= 1.12) {
    window.setTimeout(() => playSfx('alloy', { volume: 0.7 }), 90)
  }
}

export function playPlace(_isMetal: boolean): void {
  // Soft but present board set-down (stone + quiet gear tick).
  const vol = mixVolume(0.62)
  if (vol <= 0.001) return
  const a = new Audio(FILES.place)
  a.volume = vol
  a.playbackRate = 0.97 + Math.random() * 0.07
  void a.play().catch(() => {})
}

/** Overload feedback — sample only (sci-fi beep removed). */
export function playOverloadAlarm(): void {
  playSfx('overflow', { volume: 0.7 })
}

/** @deprecated kept for API compat */
export function setDangerAmbience(_level: 0 | 1 | 2 | 3): void {
  /* no-op */
}

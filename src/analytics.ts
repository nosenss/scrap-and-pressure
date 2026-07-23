/** Thin wrapper around global ItchAnalytics SDK (public/itch-analytics.js). */

import { assetUrl } from './assets'

export type AnalyticsConfig = {
  gameId: string
  writeKey: string
  apiUrl: string
  name?: string
}

type ProgressOpts = { name?: string; index?: number }

type ItchAnalyticsApi = {
  init: (opts: AnalyticsConfig) => unknown
  progress: (levelId: string, opts?: ProgressOpts) => unknown
  event: (name: string, value?: number | null) => unknown
  flush: () => unknown
}

declare global {
  interface Window {
    ItchAnalytics?: ItchAnalyticsApi
  }
}

let ready = false
let markedFirstPlace = false
let markedFirstPress = false
let markedUpgrade = false

function api(): ItchAnalyticsApi | null {
  return ready ? window.ItchAnalytics ?? null : null
}

/** Load config + init SDK. Safe if config missing (local/dev). */
export async function initAnalytics(): Promise<void> {
  if (ready) return
  try {
    const res = await fetch(assetUrl('analytics.config.json'), { cache: 'no-store' })
    if (!res.ok) {
      console.warn('[analytics] no analytics.config.json — skipped')
      return
    }
    const cfg = (await res.json()) as Partial<AnalyticsConfig>
    if (!cfg.writeKey || !cfg.apiUrl || !cfg.gameId) {
      console.warn('[analytics] incomplete config — skipped')
      return
    }
    if (!window.ItchAnalytics) {
      console.warn('[analytics] SDK not loaded')
      return
    }
    window.ItchAnalytics.init({
      gameId: cfg.gameId,
      writeKey: cfg.writeKey,
      apiUrl: cfg.apiUrl,
      name: cfg.name,
    })
    ready = true
  } catch (e) {
    console.warn('[analytics] init failed', e)
  }
}

export function trackProgress(levelId: string, opts: ProgressOpts = {}): void {
  api()?.progress(levelId, opts)
}

export function trackEvent(name: string, value?: number | null): void {
  api()?.event(name, value)
}

export function trackPowerOn(): void {
  trackProgress('power_on', { name: 'Power On', index: 0 })
  trackEvent('power_on', 1)
}

export function trackRunStart(asTutorial: boolean): void {
  markedFirstPlace = false
  markedFirstPress = false
  markedUpgrade = false
  trackProgress('run_start', {
    name: asTutorial ? 'Tutorial Start' : 'Run Start',
    index: 1,
  })
  trackEvent(asTutorial ? 'tutorial_start' : 'run_start', 1)
}

export function trackPlace(): void {
  trackEvent('place', 1)
  if (!markedFirstPlace) {
    markedFirstPlace = true
    trackProgress('first_place', { name: 'First Place', index: 2 })
  }
}

export function trackPress(value: number): void {
  trackEvent('press', value)
  if (!markedFirstPress) {
    markedFirstPress = true
    trackProgress('first_press', { name: 'First Press', index: 3 })
  }
}

export function trackUpgrade(itemId: string): void {
  trackEvent('upgrade', 1)
  trackEvent(`upgrade_${itemId}`, 1)
  if (!markedUpgrade) {
    markedUpgrade = true
    trackProgress('upgrade', { name: 'First Upgrade', index: 4 })
  }
}

export function trackOverload(level: number): void {
  trackEvent('overload', level)
}

export function trackTutorialDone(): void {
  trackEvent('tutorial_complete', 1)
  trackProgress('tutorial_done', { name: 'Tutorial Done', index: 5 })
}

export function trackGameOver(score: number): void {
  trackEvent('run_score', score)
  trackEvent('game_over', score)
  trackProgress('game_over', { name: 'Game Over', index: 6 })
  api()?.flush()
}

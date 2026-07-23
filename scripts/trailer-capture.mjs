#!/usr/bin/env node
/**
 * Capture real-game MP4 clips for the Remotion trailer.
 * Requires Vite on http://127.0.0.1:5173
 *
 *   node scripts/trailer-capture.mjs
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'trailer/public/footage')
const BASE = process.env.PROMO_URL || 'http://127.0.0.1:5173/?promo=1&v=trailer1'
const FPS = 30

const CHROME_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  '/private/var/folders/65/yvm6k2t91zv_98ns8d5svk3r0000gn/T/cursor-sandbox-cache/7739276d6f81991c4c8e39a206ade21e/playwright/chromium-1148/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (p && fs.existsSync(p)) return p
  }
  throw new Error('Chromium/Chrome not found')
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

async function waitPromo(page) {
  await page.waitForFunction(() => window.__PROMO && window.__PROMO.ready, null, {
    timeout: 20000,
  })
  await page.evaluate(() => {
    window.__PROMO.skipBoot()
    window.__PROMO.mute()
    window.__PROMO.lockScale()
  })
  await sleep(200)
}

async function recordClip(page, opts) {
  const { name, seconds, setup, act } = opts
  const framesDir = path.join(OUT, `_frames_${name}`)
  fs.rmSync(framesDir, { recursive: true, force: true })
  ensureDir(framesDir)

  await setup()
  await sleep(300)

  const total = Math.round(seconds * FPS)
  for (let i = 0; i < total; i++) {
    if (act) await act(i, total)
    const handle = await page.$('#game-wrapper')
    const framePath = path.join(framesDir, `f_${String(i).padStart(4, '0')}.png`)
    await handle.screenshot({ path: framePath, type: 'png' })
    await sleep(1000 / FPS)
  }

  const mp4 = path.join(OUT, `${name}.mp4`)
  const r = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      path.join(framesDir, 'f_%04d.png'),
      '-vf',
      'scale=1280:800:flags=neighbor',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '17',
      '-movflags',
      '+faststart',
      mp4,
    ],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) {
    console.error(r.stderr)
    throw new Error(`ffmpeg failed for ${name}`)
  }
  fs.rmSync(framesDir, { recursive: true, force: true })
  const mb = (fs.statSync(mp4).size / 1024 / 1024).toFixed(2)
  console.log(`OK ${name}.mp4  ${mb} MB`)
}

async function main() {
  ensureDir(OUT)
  const chrome = findChrome()
  console.log('Chrome:', chrome)
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
  })
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  await waitPromo(page)

  console.log('Shot1 press')
  await recordClip(page, {
    name: 'shot1_press',
    seconds: 3.0,
    setup: async () => {
      await page.evaluate(() => window.__PROMO.setupPressReady())
    },
    act: async (i) => {
      if (i === 22) {
        await page.evaluate(() => {
          window.__PROMO.press()
          window.__PROMO.toastPerfect()
        })
      }
      if (i === 35) {
        await page.evaluate(() => window.__PROMO.closeOverlays())
      }
    },
  })

  console.log('Shot2 packing')
  await recordClip(page, {
    name: 'shot2_loop',
    seconds: 4.0,
    setup: async () => {
      await page.evaluate(() => window.__PROMO.setupPackingGhost())
    },
    act: async (i) => {
      if (i === 20 || i === 40 || i === 55) {
        await page.evaluate(() => window.__PROMO.rotate())
      }
      if (i === 70) {
        await page.evaluate(() => window.__PROMO.placeGhost())
      }
      // re-arm ghost packing feel mid-clip
      if (i === 85) {
        await page.evaluate(() => window.__PROMO.setupPackingGhost())
      }
      if (i === 100 || i === 110) {
        await page.evaluate(() => window.__PROMO.rotate())
      }
    },
  })

  console.log('Shot3 upgrade')
  await recordClip(page, {
    name: 'shot3_upgrade',
    seconds: 4.0,
    setup: async () => {
      await page.evaluate(() => window.__PROMO.setupUpgradeDraft())
    },
    act: async (i) => {
      if (i === 55) {
        await page.evaluate(() => window.__PROMO.pickChamberExpansion())
      }
    },
  })

  console.log('Shot4 podium')
  await recordClip(page, {
    name: 'shot4_podium',
    seconds: 3.5,
    setup: async () => {
      await page.evaluate(() => window.__PROMO.setupLeaderboard())
    },
    act: async (i) => {
      if (i === 10) {
        await page.evaluate(() => {
          const first = document.querySelector('#lb-list li')
          if (first instanceof HTMLElement) {
            first.style.outline = '3px solid #ff8c00'
            first.style.boxShadow = '0 0 28px #ff8c00aa'
            first.style.transform = 'scale(1.04)'
          }
        })
      }
    },
  })

  console.log('Shot5 title CTA')
  await recordClip(page, {
    name: 'shot5_cta',
    seconds: 3.5,
    setup: async () => {
      await page.evaluate(() => window.__PROMO.setupTitle())
    },
  })

  await browser.close()
  console.log('\nFootage →', OUT)
  for (const f of fs.readdirSync(OUT).sort()) {
    if (!f.endsWith('.mp4')) continue
    const st = fs.statSync(path.join(OUT, f))
    console.log(`  ${f}  ${(st.size / 1024).toFixed(0)} KB`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

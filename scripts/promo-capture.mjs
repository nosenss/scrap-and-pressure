#!/usr/bin/env node
/**
 * Capture itch.io promo GIFs + screenshots into ./promo
 *
 * Usage:
 *   npm run promo:capture
 *
 * Requires Vite on http://127.0.0.1:5173 and Playwright Chromium.
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'promo')
const BASE = process.env.PROMO_URL || 'http://127.0.0.1:5173/?promo=1&v=promo1'
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
  throw new Error('Chromium/Chrome not found. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH')
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

async function shotWrapper(page, file) {
  const handle = await page.$('#game-wrapper')
  if (!handle) throw new Error('#game-wrapper missing')
  await handle.screenshot({
    path: file,
    type: 'png',
    animations: 'disabled',
  })
  // If scale left us smaller, force exact 1280x800 via ffmpeg neighbor upscale
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file],
    { encoding: 'utf8' },
  )
  const dim = (probe.stdout || '').trim()
  if (dim && dim !== '1280x800') {
    const tmp = file + '.tmp.png'
    spawnSync(
      'ffmpeg',
      ['-y', '-i', file, '-vf', 'scale=1280:800:flags=neighbor', tmp],
      { stdio: 'inherit' },
    )
    fs.renameSync(tmp, file)
  }
}

async function recordGif(page, opts) {
  const { name, seconds, setup, act } = opts
  const framesDir = path.join(OUT, `_frames_${name}`)
  fs.rmSync(framesDir, { recursive: true, force: true })
  ensureDir(framesDir)

  await setup()
  await sleep(250)

  const total = Math.round(seconds * FPS)
  const frameTimes = []
  for (let i = 0; i < total; i++) frameTimes.push(i)

  // Kick actions at specific frame indices
  const actionAt = act || (() => {})

  for (let i = 0; i < total; i++) {
    await actionAt(i, total)
    const handle = await page.$('#game-wrapper')
    const framePath = path.join(framesDir, `f_${String(i).padStart(4, '0')}.png`)
    await handle.screenshot({ path: framePath, type: 'png' })
    await sleep(1000 / FPS)
  }

  const gifPath = path.join(OUT, `${name}.gif`)
  const palette = path.join(framesDir, 'palette.png')
  // Scale to 640x400 pixelated, palette GIF, keep under ~5MB
  spawnSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      path.join(framesDir, 'f_%04d.png'),
      '-vf',
      'scale=640:400:flags=neighbor,palettegen=max_colors=96:stats_mode=diff',
      palette,
    ],
    { stdio: 'inherit' },
  )
  spawnSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      path.join(framesDir, 'f_%04d.png'),
      '-i',
      palette,
      '-lavfi',
      'scale=640:400:flags=neighbor[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle',
      '-loop',
      '0',
      gifPath,
    ],
    { stdio: 'inherit' },
  )

  // Fallback simpler encode if paletteuse failed
  if (!fs.existsSync(gifPath) || fs.statSync(gifPath).size < 1000) {
    spawnSync(
      'ffmpeg',
      [
        '-y',
        '-framerate',
        String(FPS),
        '-i',
        path.join(framesDir, 'f_%04d.png'),
        '-vf',
        'scale=640:400:flags=neighbor',
        '-gifflags',
        '-offsetting',
        '-loop',
        '0',
        gifPath,
      ],
      { stdio: 'inherit' },
    )
  }

  const sizeMb = fs.statSync(gifPath).size / (1024 * 1024)
  console.log(`GIF ${name}: ${sizeMb.toFixed(2)} MB`)
  if (sizeMb > 5) {
    // Re-encode fewer colors
    const slim = path.join(OUT, `${name}.slim.gif`)
    spawnSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        gifPath,
        '-vf',
        'fps=20,scale=640:400:flags=neighbor,split[s0][s1];[s0]palettegen=max_colors=48[p];[s1][p]paletteuse=dither=none',
        slim,
      ],
      { stdio: 'inherit' },
    )
    if (fs.existsSync(slim) && fs.statSync(slim).size < fs.statSync(gifPath).size) {
      fs.renameSync(slim, gifPath)
      console.log(`  slimmed → ${(fs.statSync(gifPath).size / (1024 * 1024)).toFixed(2)} MB`)
    }
  }

  fs.rmSync(framesDir, { recursive: true, force: true })
}

async function main() {
  ensureDir(OUT)
  const executablePath = findChrome()
  console.log('Chrome:', executablePath)

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--disable-web-security', '--autoplay-policy=no-user-gesture-required'],
  })
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  await waitPromo(page)

  // --- GIFs first (must not leave leaderboard open over them) ---
  console.log('GIF: press impact')
  await recordGif(page, {
    name: 'preview_01_press_impact',
    seconds: 2.5,
    setup: async () => {
      await page.evaluate(() => {
        window.__PROMO.setupPressReady()
      })
    },
    act: async (i) => {
      if (i === 8) {
        await page.evaluate(() => {
          window.__PROMO.press()
          window.__PROMO.toastPerfect()
        })
      }
      if (i === 16) {
        await page.evaluate(() => window.__PROMO.closeOverlays())
      }
    },
  })

  console.log('GIF: packing ghost')
  await recordGif(page, {
    name: 'preview_02_packing_ghost',
    seconds: 2.0,
    setup: async () => {
      await page.evaluate(() => window.__PROMO.setupPackingGhost())
    },
    act: async (i) => {
      if (i === 10 || i === 20) {
        await page.evaluate(() => window.__PROMO.rotate())
      }
      if (i === 40) {
        await page.evaluate(() => window.__PROMO.placeGhost())
      }
    },
  })

  console.log('GIF: upgrade draft')
  await recordGif(page, {
    name: 'preview_03_upgrade_draft',
    seconds: 2.5,
    setup: async () => {
      await page.evaluate(() => window.__PROMO.setupUpgradeDraft())
    },
    act: async (i) => {
      if (i === 35) {
        await page.evaluate(() => window.__PROMO.pickChamberExpansion())
      }
    },
  })

  // --- Screenshots ---
  console.log('Screenshot: title')
  await page.evaluate(() => window.__PROMO.setupTitle())
  await sleep(400)
  await shotWrapper(page, path.join(OUT, 'screenshot_01_title_screen.png'))

  console.log('Screenshot: gameplay')
  await page.evaluate(() => window.__PROMO.setupGameplay())
  await sleep(400)
  await shotWrapper(page, path.join(OUT, 'screenshot_02_gameplay.png'))

  console.log('Screenshot: leaderboard')
  await page.evaluate(() => window.__PROMO.setupLeaderboard())
  await sleep(400)
  await shotWrapper(page, path.join(OUT, 'screenshot_03_leaderboard.png'))

  await browser.close()
  console.log('\nDone →', OUT)
  for (const f of fs.readdirSync(OUT).sort()) {
    if (f.startsWith('_')) continue
    const st = fs.statSync(path.join(OUT, f))
    console.log(`  ${f}  ${(st.size / 1024).toFixed(0)} KB`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

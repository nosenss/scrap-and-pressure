import * as THREE from 'three'
import {
  createCinematicPixelMaterial,
  hardenPixelTexture,
  configureRendererForReplaced,
  setupReplacedLighting,
  setupCinematicComposer,
  createPressSteamVfx,
} from './index.js'

/** Tiny procedural pixel albedo (no external assets needed). */
function makePixelTexture({
  w = 16,
  h = 16,
  paint,
  normal = false,
} = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const [r, g, b, a = 255] = paint(x, y, w, h)
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = a
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.flipY = false
  if (normal) {
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    tex.colorSpace = THREE.NoColorSpace
  } else {
    hardenPixelTexture(tex)
  }
  return tex
}

function scrapAlbedo(seedHue) {
  return makePixelTexture({
    w: 16,
    h: 16,
    paint: (x, y) => {
      const n = ((x * 13 + y * 7) % 5) / 5
      const rust = (x + y) % 7 === 0
      if (rust) return [120 + seedHue, 55, 35]
      const v = 70 + n * 90 + seedHue * 0.2
      return [v, v * 0.92, v * 0.78]
    },
  })
}

function metalNormal() {
  return makePixelTexture({
    w: 16,
    h: 16,
    normal: true,
    paint: (x, y) => {
      // Fake tangent-space bumps (purple-ish normal map)
      const nx = 128 + ((x % 4) - 1.5) * 18
      const ny = 128 + ((y % 4) - 1.5) * 18
      return [nx, ny, 255]
    },
  })
}

function panelAlbedo() {
  return makePixelTexture({
    w: 16,
    h: 16,
    paint: (x, y) => {
      if (y < 3) return [40, 48, 62]
      if ((x + y) % 6 === 0) return [255, 60, 70]
      if (x > 11 && y > 10) return [255, 170, 60]
      return [48, 52, 68]
    },
  })
}

function floorAlbedo() {
  return makePixelTexture({
    w: 32,
    h: 32,
    paint: (x, y) => {
      const tile = ((x >> 3) ^ (y >> 3)) & 1
      const base = tile ? 28 : 22
      const speck = (x * y) % 11 === 0 ? 10 : 0
      return [base + speck, base + 4, base + 8]
    },
  })
}

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
document.body.prepend(renderer.domElement)
configureRendererForReplaced(renderer)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x070a10)
scene.fog = new THREE.FogExp2(0x070a10, 0.045)

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 80)
camera.position.set(4.8, 3.6, 6.2)
camera.lookAt(0, 1.1, 0)

// --- Stage ---
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(18, 18),
  createCinematicPixelMaterial({
    mapUrl: floorAlbedo(),
    roughness: 0.85,
    metalness: 0.05,
  }),
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

const pressGroup = new THREE.Group()
pressGroup.position.set(0, 0, 0)
scene.add(pressGroup)

const frameMat = createCinematicPixelMaterial({
  mapUrl: scrapAlbedo(10),
  normalMapUrl: metalNormal(),
  roughness: 0.35,
  metalness: 0.7,
  normalScale: 1.3,
  color: 0xc8c2b4,
})

const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 2.6), frameMat)
base.position.y = 0.22
base.castShadow = true
base.receiveShadow = true
pressGroup.add(base)

const pillars = [
  [-1.05, 1.1, -1.05],
  [1.05, 1.1, -1.05],
  [-1.05, 1.1, 1.05],
  [1.05, 1.1, 1.05],
]
for (const [x, y, z] of pillars) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.0, 0.28), frameMat)
  p.position.set(x, y, z)
  p.castShadow = true
  pressGroup.add(p)
}

const ramMat = createCinematicPixelMaterial({
  mapUrl: scrapAlbedo(0),
  normalMapUrl: metalNormal(),
  roughness: 0.28,
  metalness: 0.85,
  emissive: 0x221100,
  emissiveIntensity: 0.35,
})
const ram = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.35, 2.1), ramMat)
ram.position.y = 2.35
ram.castShadow = true
pressGroup.add(ram)

// Scrap cubes inside chamber
const scraps = []
const scrapDefs = [
  { c: 0x3aa0c8, m: 0.1, r: 0.55, p: [-0.45, 0.55, -0.2] },
  { c: 0x8b9299, m: 0.8, r: 0.25, p: [0.35, 0.5, 0.15] },
  { c: 0x5aaa78, m: 0.05, r: 0.4, p: [0.05, 0.7, -0.45] },
  { c: 0xb87a4a, m: 0.02, r: 0.7, p: [-0.15, 0.48, 0.4] },
]
for (const d of scrapDefs) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.45, 0.5),
    createCinematicPixelMaterial({
      mapUrl: scrapAlbedo(d.c & 0xff),
      normalMapUrl: metalNormal(),
      color: d.c,
      roughness: d.r,
      metalness: d.m,
    }),
  )
  mesh.position.set(...d.p)
  mesh.rotation.y = Math.random() * 0.6
  mesh.castShadow = true
  mesh.receiveShadow = true
  pressGroup.add(mesh)
  scraps.push(mesh)
}

// Control panel with neon-catching emissive
const panel = new THREE.Mesh(
  new THREE.BoxGeometry(0.7, 1.1, 0.2),
  createCinematicPixelMaterial({
    mapUrl: panelAlbedo(),
    roughness: 0.45,
    metalness: 0.35,
    emissive: 0xff2244,
    emissiveIntensity: 1.8,
  }),
)
panel.position.set(2.1, 1.05, 1.35)
panel.castShadow = true
scene.add(panel)

const lamp = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 8, 8),
  createCinematicPixelMaterial({
    color: 0xffb45a,
    emissive: 0xff9940,
    emissiveIntensity: 3.5,
    roughness: 0.6,
    metalness: 0.1,
  }),
)
lamp.position.set(0.15, 3.55, 1.55)
scene.add(lamp)

// Backdrop wall
const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 7),
  createCinematicPixelMaterial({
    mapUrl: floorAlbedo(),
    roughness: 0.9,
    metalness: 0.02,
    color: 0x6a7388,
  }),
)
wall.position.set(0, 3.2, -4.2)
wall.receiveShadow = true
scene.add(wall)

const lights = setupReplacedLighting(scene, {
  pressTarget: pressGroup,
  controlPanelPosition: panel.position.clone().add(new THREE.Vector3(0, 0.4, 0.3)),
  spotPosition: new THREE.Vector3(0.3, 6.2, 2.8),
})

const fx = setupCinematicComposer(renderer, scene, camera, {
  bloomThreshold: 0.78,
  bloomStrength: 1.25,
  bloomRadius: 0.32,
})

const steam = createPressSteamVfx(scene)
steam.syncFromLights({ ambient: lights.ambient, spot: lights.spot })

let pressing = false
let ramY = 2.35
let scrapScale = 1

function doPress() {
  if (pressing) return
  pressing = true
  lights.flashPress(1.85, 160)
  steam.spawnBurst(new THREE.Vector3(0, 0.9, 0), 42, 1.25)

  const start = performance.now()
  const dur = 420
  const from = 2.35
  const to = 1.05

  function slam(now) {
    const t = Math.min(1, (now - start) / dur)
    const ease = t < 0.55 ? (t / 0.55) ** 2 : 1 - ((t - 0.55) / 0.45) ** 1.5 * 0.15
    ramY = from + (to - from) * Math.min(1, ease)
    scrapScale = 1 - Math.min(1, Math.max(0, (t - 0.35) / 0.4)) * 0.45
    if (t < 1) requestAnimationFrame(slam)
    else {
      setTimeout(() => {
        ramY = from
        scrapScale = 1
        pressing = false
      }, 280)
    }
  }
  requestAnimationFrame(slam)
}

document.getElementById('press')?.addEventListener('click', doPress)
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault()
    doPress()
  }
})

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  fx.setSize(innerWidth, innerHeight)
})

const clock = new THREE.Clock()
;(function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(0.05, clock.getDelta())
  const t = clock.elapsedTime

  camera.position.x = 4.8 + Math.sin(t * 0.25) * 0.35
  camera.position.y = 3.6 + Math.sin(t * 0.18) * 0.12
  camera.lookAt(0, 1.05, 0)

  ram.position.y = ramY
  for (const s of scraps) {
    s.scale.setScalar(scrapScale)
  }

  lights.pulseNeon(0.55, dt)
  steam.update(dt)
  steam.syncFromLights({ ambient: lights.ambient, spot: lights.spot })
  fx.render()
})()

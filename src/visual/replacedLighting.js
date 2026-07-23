import * as THREE from 'three'

/**
 * Hard industrial key + cold fill — REPLACED / The Last Night night-yard vibe.
 * Returns a handle so you can aim the spot at the press and pulse the neon.
 *
 * @param {THREE.Scene} scene
 * @param {object} [opts]
 * @param {THREE.Vector3|THREE.Object3D} [opts.pressTarget] aim spot at press
 * @param {THREE.Vector3} [opts.controlPanelPosition] neon near controls
 */
export function setupReplacedLighting(scene, opts = {}) {
  const {
    pressTarget = new THREE.Vector3(0, 0, 0),
    controlPanelPosition = new THREE.Vector3(1.4, 1.1, 1.2),
    spotPosition = new THREE.Vector3(0.2, 6.5, 2.4),
  } = opts

  // Cold cyan fill — keeps unlit scrap readable but gloomy
  const ambient = new THREE.AmbientLight(0x1a3a4a, 0.2)
  ambient.name = 'replaced-ambient'
  scene.add(ambient)

  // Soft hemisphere bounce (ground scrap / wet asphalt)
  const hemi = new THREE.HemisphereLight(0x2a4a5e, 0x1a1008, 0.35)
  hemi.name = 'replaced-hemi'
  scene.add(hemi)

  // Hot key over the press — hard shadows, cinematic falloff
  const spot = new THREE.SpotLight(0xffb45a, 48, 28, Math.PI / 5.5, 0.28, 1.6)
  spot.name = 'replaced-press-spot'
  spot.position.copy(spotPosition)
  spot.castShadow = true
  spot.shadow.mapSize.set(2048, 2048)
  spot.shadow.bias = -0.00018
  spot.shadow.normalBias = 0.03
  spot.shadow.camera.near = 0.5
  spot.shadow.camera.far = 30
  spot.shadow.radius = 1 // keep edges relatively hard (pixel drama)
  scene.add(spot)

  const spotTarget = new THREE.Object3D()
  spotTarget.name = 'replaced-press-spot-target'
  if (pressTarget.isObject3D) {
    spotTarget.position.set(0, 0, 0)
    pressTarget.add(spotTarget)
  } else {
    spotTarget.position.copy(pressTarget)
    scene.add(spotTarget)
  }
  spot.target = spotTarget
  scene.add(spot.target)

  // Neon / alarm accent on the control panel
  const neon = new THREE.PointLight(0xff2244, 6.5, 7.5, 2)
  neon.name = 'replaced-neon'
  neon.position.copy(controlPanelPosition)
  neon.castShadow = false
  scene.add(neon)

  // Tiny cool rim so silhouettes separate from the void
  const rim = new THREE.DirectionalLight(0x4aa0c8, 0.55)
  rim.name = 'replaced-rim'
  rim.position.set(-4, 3, -5)
  scene.add(rim)

  return {
    ambient,
    hemi,
    spot,
    spotTarget,
    neon,
    rim,
    /** Pulse neon on overflow / alarm without touching game logic */
    pulseNeon(amount = 1, dt = 0.016) {
      const base = 6.5
      neon.intensity = base + Math.sin(performance.now() * 0.018) * 2.2 * amount
      void dt
    },
    /** Brief flash when the press slams */
    flashPress(boost = 1.6, ms = 120) {
      const prev = spot.intensity
      spot.intensity = prev * boost
      window.setTimeout(() => {
        spot.intensity = prev
      }, ms)
    },
  }
}

/**
 * Enable renderer flags required by the lighting kit.
 */
export function configureRendererForReplaced(renderer) {
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  return renderer
}

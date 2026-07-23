/**
 * Example: wrap an EXISTING Three.js press/scrap scene
 * with cinematic 2.5D pixel visuals — no gameplay changes.
 *
 * Copy the pattern into your game's bootstrap / animate loop.
 */
import * as THREE from 'three'
import {
  applyCinematicPixelMaterial,
  createCinematicPixelMaterial,
  configureRendererForReplaced,
  setupReplacedLighting,
  setupCinematicComposer,
  createPressSteamVfx,
} from './index.js'

/**
 * @param {object} game your existing objects
 * @param {THREE.WebGLRenderer} game.renderer
 * @param {THREE.Scene} game.scene
 * @param {THREE.Camera} game.camera
 * @param {THREE.Object3D} game.pressMesh
 * @param {THREE.Object3D} [game.scrapRoot] parent of trash meshes
 * @param {THREE.Object3D|THREE.Vector3} [game.controlPanel]
 */
export function mountCinematicPixelLook(game) {
  const { renderer, scene, camera, pressMesh, scrapRoot, controlPanel } = game

  configureRendererForReplaced(renderer)

  // 1) Materials — keep geometry / userData / colliders as-is
  applyCinematicPixelMaterial(pressMesh, {
    // mapUrl / normalMapUrl: leave empty to reuse textures already on the mesh
    roughness: 0.38,
    metalness: 0.55,
    normalScale: 1.25,
  })

  if (scrapRoot) {
    scrapRoot.traverse((obj) => {
      if (!obj.isMesh) return
      const isMetal = obj.userData?.material === 'metal'
      applyCinematicPixelMaterial(obj, {
        roughness: isMetal ? 0.28 : 0.55,
        metalness: isMetal ? 0.75 : 0.08,
        normalScale: 1.15,
      })
    })
  }

  // Or build a fresh emissive lamp material for bloom to catch:
  // const lampMat = createCinematicPixelMaterial({
  //   mapUrl: '/textures/pixel/lamp.png',
  //   emissive: 0xff9944,
  //   emissiveIntensity: 2.5,
  //   roughness: 0.6,
  // })

  // 2) Lighting
  const panelPos = controlPanel?.isObject3D
    ? controlPanel.getWorldPosition(new THREE.Vector3())
    : controlPanel ?? new THREE.Vector3(1.4, 1.1, 1.2)

  const lights = setupReplacedLighting(scene, {
    pressTarget: pressMesh,
    controlPanelPosition: panelPos,
  })

  // 3) Post
  const fx = setupCinematicComposer(renderer, scene, camera, {
    bloomThreshold: 0.8,
    bloomStrength: 1.2,
    bloomRadius: 0.35,
  })
  fx.bindResize()

  // 4) Steam VFX
  const steam = createPressSteamVfx(scene)
  steam.syncFromLights({ ambient: lights.ambient, spot: lights.spot })

  /**
   * Call from YOUR press-success callback (logic stays yours):
   *   onPressComplete() { cinematic.onPress(pressMesh.position) }
   */
  function onPress(worldPos) {
    lights.flashPress(1.7, 140)
    steam.spawnBurst(worldPos, 36, 1.15)
  }

  /**
   * Drop into your existing animate():
   *   function animate() {
   *     requestAnimationFrame(animate)
   *     updateGameplay(dt)
   *     cinematic.update(dt)
   *     cinematic.render()   // instead of renderer.render(scene, camera)
   *   }
   */
  function update(dt) {
    steam.update(dt)
    lights.pulseNeon(game.overflowAlarm ? 1 : 0.25, dt)
  }

  function render() {
    fx.render()
  }

  return { lights, fx, steam, onPress, update, render, createCinematicPixelMaterial }
}

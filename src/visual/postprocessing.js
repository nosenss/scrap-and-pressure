import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

/**
 * Soft vignette + slight edge softening (cinematic frame, not DOF).
 */
export const CinematicFringeShader = {
  name: 'CinematicFringeShader',
  uniforms: {
    tDiffuse: { value: null },
    vignetteOffset: { value: 0.35 },
    vignetteDarkness: { value: 1.15 },
    edgeBlur: { value: 0.55 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float vignetteOffset;
    uniform float vignetteDarkness;
    uniform float edgeBlur;
    uniform vec2 resolution;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 center = uv - 0.5;
      float dist = length(center);

      // Cheap radial soft-sample toward edges (reads as mild fringe blur)
      float blurAmt = smoothstep(0.25, 0.85, dist) * edgeBlur;
      vec2 px = (1.0 / resolution) * blurAmt * 2.5;
      vec4 color = texture2D(tDiffuse, uv) * 0.4;
      color += texture2D(tDiffuse, uv + vec2( px.x, 0.0)) * 0.15;
      color += texture2D(tDiffuse, uv - vec2( px.x, 0.0)) * 0.15;
      color += texture2D(tDiffuse, uv + vec2(0.0,  px.y)) * 0.15;
      color += texture2D(tDiffuse, uv - vec2(0.0,  px.y)) * 0.15;

      // Vignette
      float vig = smoothstep(0.8, vignetteOffset * 0.45, dist);
      color.rgb *= mix(1.0, 1.0 - vignetteDarkness * 0.55, 1.0 - vig);

      // Tiny teal lift in crushed blacks (REPLACED night grade)
      color.rgb = mix(color.rgb, color.rgb * vec3(0.92, 1.02, 1.08), 0.12);

      gl_FragColor = color;
    }
  `,
}

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {object} [opts]
 */
export function setupCinematicComposer(renderer, scene, camera, opts = {}) {
  const {
    bloomThreshold = 0.8,
    bloomStrength = 1.2,
    bloomRadius = 0.35,
    vignetteDarkness = 1.15,
    edgeBlur = 0.55,
  } = opts

  const size = new THREE.Vector2()
  renderer.getSize(size)

  const composer = new EffectComposer(renderer)
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  composer.setSize(size.x, size.y)

  const renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    bloomStrength,
    bloomRadius,
    bloomThreshold,
  )
  composer.addPass(bloom)

  const fringe = new ShaderPass(CinematicFringeShader)
  fringe.uniforms.vignetteDarkness.value = vignetteDarkness
  fringe.uniforms.edgeBlur.value = edgeBlur
  fringe.uniforms.resolution.value.set(size.x, size.y)
  composer.addPass(fringe)

  composer.addPass(new OutputPass())

  function setSize(width, height) {
    composer.setSize(width, height)
    bloom.resolution.set(width, height)
    fringe.uniforms.resolution.value.set(width, height)
  }

  function render() {
    composer.render()
  }

  return {
    composer,
    bloom,
    fringe,
    setSize,
    render,
    /** Hook for your existing animate loop — replaces renderer.render(...) */
    bindResize(domElement = renderer.domElement) {
      const onResize = () => {
        const w = domElement.clientWidth
        const h = domElement.clientHeight
        renderer.setSize(w, h, false)
        if (camera.isPerspectiveCamera) {
          camera.aspect = w / h
          camera.updateProjectionMatrix()
        }
        setSize(w, h)
      }
      window.addEventListener('resize', onResize)
      onResize()
      return () => window.removeEventListener('resize', onResize)
    },
  }
}

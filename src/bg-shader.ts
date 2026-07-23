import {
  ShaderMount,
  warpFragmentShader,
  WarpPatterns,
  getShaderColorFromString,
  getShaderNoiseTexture,
  ShaderFitOptions,
} from '@paper-design/shaders'

/** Industrial Amber & Dark Metal Warp backdrop behind the cabin. */
export function mountIndustrialWarp(): ShaderMount | null {
  const container = document.getElementById('bg-shader')
  if (!container) return null

  const disposePrior = () => {
    const prior = (container as HTMLElement & { paperShaderMount?: ShaderMount }).paperShaderMount
    if (prior) {
      try {
        prior.dispose()
      } catch {
        /* */
      }
    }
    container.replaceChildren()
  }

  const colors = ['#050608', '#2a1408', '#ff9a1a', '#c45c00', '#ff4400'].map((c) =>
    getShaderColorFromString(c),
  )

  const noise = getShaderNoiseTexture()

  const mountNow = (): ShaderMount | null => {
    try {
      disposePrior()
      return new ShaderMount(
        container,
        warpFragmentShader,
        {
          u_colors: colors,
          u_colorsCount: colors.length,
          u_proportion: 0.42,
          u_softness: 0.7,
          u_shape: WarpPatterns.checks,
          u_shapeScale: 0.1,
          u_distortion: 0.3,
          u_swirl: 0.7,
          u_swirlIterations: 6,
          u_noiseTexture: noise,
          u_fit: ShaderFitOptions.none,
          u_scale: 1,
          u_rotation: 0,
          u_offsetX: 0,
          u_offsetY: 0,
          u_originX: 0.5,
          u_originY: 0.5,
          u_worldWidth: 0,
          u_worldHeight: 0,
        },
        { alpha: true, antialias: false, powerPreference: 'low-power' },
        0.25,
        0,
        0.5,
        1280 * 720,
      )
    } catch (err) {
      console.warn('[bg-shader] mount failed', err)
      return null
    }
  }

  // Noise texture may still be decoding — Paper Shaders throws if incomplete.
  if (noise && !noise.complete) {
    noise.addEventListener(
      'load',
      () => {
        mountNow()
      },
      { once: true },
    )
    noise.addEventListener(
      'error',
      () => {
        console.warn('[bg-shader] noise texture failed to load')
      },
      { once: true },
    )
    return null
  }

  return mountNow()
}

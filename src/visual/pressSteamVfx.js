import * as THREE from 'three'

/**
 * Lit pixel steam / dust burst for press impacts.
 * Uses THREE.Points + a tiny custom shader that approximates
 * ambient + warm key light (so puffs catch the press spot).
 */
const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aLife;
  attribute float aSeed;
  uniform float uPixelRatio;
  varying float vLife;
  varying float vSeed;

  void main() {
    vLife = aLife;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float fade = smoothstep(0.0, 0.15, aLife) * smoothstep(0.0, 0.35, 1.0 - aLife);
    gl_PointSize = max(1.0, aSize * fade * uPixelRatio * (90.0 / max(1.0, -mv.z)));
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  varying float vLife;
  varying float vSeed;
  uniform vec3 uAmbientColor;
  uniform vec3 uKeyColor;
  uniform vec3 uKeyDir;
  uniform float uKeyIntensity;
  uniform vec3 uBaseColor;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = length(uv);
    if (d > 1.0) discard;

    // Soft pixel-ish core (quantized falloff)
    float core = 1.0 - smoothstep(0.15, 1.0, d);
    core = floor(core * 4.0) / 4.0;

    // Fake lit normal from point sprite sphere
    vec3 n = normalize(vec3(uv, sqrt(max(0.0, 1.0 - d * d))));
    float ndl = max(0.0, dot(n, normalize(-uKeyDir)));
    vec3 lit = uAmbientColor + uKeyColor * uKeyIntensity * ndl;

    float flicker = 0.85 + 0.15 * fract(sin(vSeed * 12.9898) * 43758.5453);
    float alpha = core * smoothstep(0.0, 0.2, vLife) * smoothstep(0.0, 0.45, 1.0 - vLife) * 0.75 * flicker;

    vec3 col = uBaseColor * lit;
    // Warm emissive lift so bloom catches the puff
    col += uKeyColor * 0.35 * core;

    gl_FragColor = vec4(col, alpha);
  }
`

/**
 * @param {THREE.Scene} scene
 * @param {object} [opts]
 */
export function createPressSteamVfx(scene, opts = {}) {
  const {
    maxParticles = 160,
    baseColor = new THREE.Color(0xe8dcc8),
    ambientColor = new THREE.Color(0x1a3a4a),
    keyColor = new THREE.Color(0xffb45a),
    keyDir = new THREE.Vector3(0.15, -1, 0.35).normalize(),
    keyIntensity = 1.4,
  } = opts

  const positions = new Float32Array(maxParticles * 3)
  const aSize = new Float32Array(maxParticles)
  const aLife = new Float32Array(maxParticles)
  const aSeed = new Float32Array(maxParticles)
  const velocity = new Float32Array(maxParticles * 3)

  for (let i = 0; i < maxParticles; i++) {
    aLife[i] = 0
    aSize[i] = 1
    aSeed[i] = Math.random()
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))
  geo.setAttribute('aLife', new THREE.BufferAttribute(aLife, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1))

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uAmbientColor: { value: ambientColor },
      uKeyColor: { value: keyColor },
      uKeyDir: { value: keyDir },
      uKeyIntensity: { value: keyIntensity },
      uBaseColor: { value: baseColor },
    },
    vertexShader,
    fragmentShader,
  })

  const points = new THREE.Points(geo, mat)
  points.name = 'press-steam-vfx'
  points.frustumCulled = false
  scene.add(points)

  let cursor = 0

  function spawnBurst(origin, count = 28, force = 1) {
    const o = origin.isVector3 ? origin : new THREE.Vector3().copy(origin)
    for (let n = 0; n < count; n++) {
      const i = cursor % maxParticles
      cursor++
      const i3 = i * 3
      positions[i3] = o.x + (Math.random() - 0.5) * 0.35
      positions[i3 + 1] = o.y + Math.random() * 0.1
      positions[i3 + 2] = o.z + (Math.random() - 0.5) * 0.35

      velocity[i3] = (Math.random() - 0.5) * 0.9 * force
      velocity[i3 + 1] = (0.55 + Math.random() * 1.1) * force
      velocity[i3 + 2] = (Math.random() - 0.5) * 0.9 * force

      aLife[i] = 1
      aSize[i] = 4 + Math.random() * 10
      aSeed[i] = Math.random()
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.aLife.needsUpdate = true
    geo.attributes.aSize.needsUpdate = true
    geo.attributes.aSeed.needsUpdate = true
  }

  function update(dt = 0.016) {
    let alive = false
    for (let i = 0; i < maxParticles; i++) {
      if (aLife[i] <= 0) continue
      alive = true
      const i3 = i * 3
      aLife[i] -= dt * (0.55 + (aSeed[i] % 1) * 0.45)
      positions[i3] += velocity[i3] * dt
      positions[i3 + 1] += velocity[i3 + 1] * dt
      positions[i3 + 2] += velocity[i3 + 2] * dt
      // drag + slight sideways swirl
      velocity[i3] *= 0.96
      velocity[i3 + 1] *= 0.98
      velocity[i3 + 1] += 0.15 * dt
      velocity[i3 + 2] *= 0.96
      if (aLife[i] < 0) aLife[i] = 0
    }
    if (alive) {
      geo.attributes.position.needsUpdate = true
      geo.attributes.aLife.needsUpdate = true
    }
  }

  /** Sync fake lighting with your REPLACED spot if you want */
  function syncFromLights({ ambient, spot } = {}) {
    if (ambient?.color) mat.uniforms.uAmbientColor.value.copy(ambient.color).multiplyScalar(0.35)
    if (spot?.color) {
      mat.uniforms.uKeyColor.value.copy(spot.color)
      mat.uniforms.uKeyIntensity.value = Math.min(2.2, spot.intensity * 0.04)
      const dir = new THREE.Vector3().subVectors(points.position, spot.position).normalize()
      mat.uniforms.uKeyDir.value.copy(dir)
    }
  }

  return {
    points,
    material: mat,
    spawnBurst,
    update,
    syncFromLights,
    dispose() {
      scene.remove(points)
      geo.dispose()
      mat.dispose()
    },
  }
}

import * as THREE from 'three'

/**
 * Crisp 2.5D pixel textures: no bilinear smear, no mip blur.
 * Call on every map you assign to cinematic materials.
 */
export function hardenPixelTexture(texture, { anisotropy = 1 } = {}) {
  if (!texture) return texture
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.anisotropy = anisotropy
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * Normal / roughness / metalness maps stay in linear space.
 */
export function hardenDataTexture(texture) {
  if (!texture) return texture
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

const loader = new THREE.TextureLoader()

function loadMap(url, hardener) {
  if (!url) return null
  if (url.isTexture) return hardener(url)
  const tex = loader.load(url)
  return hardener(tex)
}

/**
 * PBR material tuned for REPLACED / The Last Night style:
 * chunky albedo + normal response under hard industrial lights.
 *
 * @param {object} opts
 * @param {string|THREE.Texture} [opts.mapUrl] albedo
 * @param {string|THREE.Texture} [opts.normalMapUrl]
 * @param {string|THREE.Texture} [opts.roughnessMapUrl]
 * @param {string|THREE.Texture} [opts.metalnessMapUrl]
 * @param {string|THREE.Texture} [opts.emissiveMapUrl]
 * @param {number} [opts.roughness=0.4]
 * @param {number} [opts.metalness=0.15]
 * @param {number} [opts.normalScale=1.1]
 * @param {THREE.ColorRepresentation} [opts.color=0xffffff]
 * @param {THREE.ColorRepresentation} [opts.emissive=0x000000]
 * @param {number} [opts.emissiveIntensity=1]
 * @param {boolean} [opts.transparent=false]
 * @param {number} [opts.opacity=1]
 */
export function createCinematicPixelMaterial({
  mapUrl,
  normalMapUrl,
  roughnessMapUrl,
  metalnessMapUrl,
  emissiveMapUrl,
  roughness = 0.4,
  metalness = 0.15,
  normalScale = 1.1,
  color = 0xffffff,
  emissive = 0x000000,
  emissiveIntensity = 1,
  transparent = false,
  opacity = 1,
} = {}) {
  const map = loadMap(mapUrl, hardenPixelTexture)
  const normalMap = loadMap(normalMapUrl, hardenDataTexture)
  const roughnessMap = loadMap(roughnessMapUrl, hardenDataTexture)
  const metalnessMap = loadMap(metalnessMapUrl, hardenDataTexture)
  const emissiveMap = loadMap(emissiveMapUrl, hardenPixelTexture)

  const mat = new THREE.MeshStandardMaterial({
    color,
    map,
    normalMap,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    roughnessMap,
    metalnessMap,
    emissiveMap,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    transparent,
    opacity,
    // Flat-ish faces read more “sprite-in-3D” under spot lights
    flatShading: false,
  })

  // Keep pixel edges hard if the mesh uses UV bleeding
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `
      #ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        // Slight contrast punch — cinematic scrapyard albedo
        sampledDiffuseColor.rgb = pow( sampledDiffuseColor.rgb, vec3( 0.92 ) );
        diffuseColor *= sampledDiffuseColor;
      #endif
      `,
    )
  }

  return mat
}

/**
 * Swap an existing mesh (or group) onto cinematic pixel materials
 * without touching gameplay logic / userData.
 */
export function applyCinematicPixelMaterial(root, options = {}) {
  root.traverse((obj) => {
    if (!obj.isMesh) return
    const prev = obj.material
    const map =
      options.mapUrl ??
      (Array.isArray(prev) ? prev[0]?.map : prev?.map) ??
      null
    const normalMap =
      options.normalMapUrl ??
      (Array.isArray(prev) ? prev[0]?.normalMap : prev?.normalMap) ??
      null

    if (map?.isTexture) hardenPixelTexture(map)
    if (normalMap?.isTexture) hardenDataTexture(normalMap)

    obj.material = createCinematicPixelMaterial({
      ...options,
      mapUrl: map,
      normalMapUrl: normalMap,
      roughness: options.roughness ?? (Array.isArray(prev) ? prev[0]?.roughness : prev?.roughness) ?? 0.4,
      metalness: options.metalness ?? (Array.isArray(prev) ? prev[0]?.metalness : prev?.metalness) ?? 0.15,
    })
    obj.castShadow = true
    obj.receiveShadow = true
  })
  return root
}

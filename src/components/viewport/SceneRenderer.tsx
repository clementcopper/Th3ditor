import { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'

// Required once before any RectAreaLight renders
RectAreaLightUniformsLib.init()

/** Quad Sphere: BoxGeometry inflated to sphere with spherical (lat/lon) UV remapping.
 *  toNonIndexed() gives each triangle its own vertices, so the longitude seam can be
 *  corrected per-triangle without conflicting with other faces.
 *  Result: 1 seam (back of sphere, u=0/1) instead of 12 cube-edge seams; no pole singularity. */
function createQuadSphere(radius: number, segments: number): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments)
  const geo = box.toNonIndexed()
  box.dispose()

  const pos = geo.attributes.position as THREE.BufferAttribute
  const norm = geo.attributes.normal as THREE.BufferAttribute

  // Inflate vertices to sphere, set normals = normalize(position) — exact for a sphere
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const len = Math.sqrt(x * x + y * y + z * z)
    const nx = x / len, ny = y / len, nz = z / len
    pos.setXYZ(i, nx * radius, ny * radius, nz * radius)
    norm.setXYZ(i, nx, ny, nz)
  }
  pos.needsUpdate = true
  norm.needsUpdate = true

  // Spherical UV: atan2(z,x) → u ∈ [0,1],  asin(y/r) → v ∈ [0,1]
  const uvData = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const r = Math.sqrt(x * x + y * y + z * z)
    uvData[i * 2]     = Math.atan2(z, x) / (Math.PI * 2) + 0.5
    uvData[i * 2 + 1] = Math.asin(Math.max(-1, Math.min(1, y / r))) / Math.PI + 0.5
  }

  // Seam fix: if a triangle's u-values span > 0.5 it straddles the longitude seam.
  // Bump the low-u vertices by +1 so GPU interpolation stays continuous across the triangle.
  for (let f = 0; f < pos.count / 3; f++) {
    const i0 = f * 3, i1 = f * 3 + 1, i2 = f * 3 + 2
    const u0 = uvData[i0 * 2], u1 = uvData[i1 * 2], u2 = uvData[i2 * 2]
    const uMax = Math.max(u0, u1, u2)
    if (uMax - u0 > 0.5) uvData[i0 * 2] += 1
    if (uMax - u1 > 0.5) uvData[i1 * 2] += 1
    if (uMax - u2 > 0.5) uvData[i2 * 2] += 1
  }

  geo.setAttribute('uv', new THREE.BufferAttribute(uvData, 2))
  return geo
}

// Cache: dataUrl → loaded BufferGeometry array (one per mesh index in the glTF)
// Keeps the same geometries alive so multiple gltf-mesh nodes sharing the same file don't reload it.
const gltfGeometryCache = new Map<string, THREE.BufferGeometry[]>()
const gltfGeometryLoading = new Map<string, Promise<THREE.BufferGeometry[]>>()

function loadGltfGeometries(dataUrl: string, extraFiles?: { name: string; dataUrl: string }[]): Promise<THREE.BufferGeometry[]> {
  if (gltfGeometryCache.has(dataUrl)) return Promise.resolve(gltfGeometryCache.get(dataUrl)!)
  if (gltfGeometryLoading.has(dataUrl)) return gltfGeometryLoading.get(dataUrl)!

  const loading = new Promise<THREE.BufferGeometry[]>((resolve) => {
    const manager = new THREE.LoadingManager()
    if (extraFiles && extraFiles.length > 0) {
      const urlMap = new Map(extraFiles.map((f) => [f.name, f.dataUrl]))
      manager.setURLModifier((url) => {
        const filename = url.split('/').pop()?.split('?')[0] ?? ''
        return urlMap.get(filename) ?? url
      })
    }
    const loader = new GLTFLoader(manager)
    loader.load(dataUrl, (gltf) => {
      const geos: THREE.BufferGeometry[] = []
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) geos.push((child as THREE.Mesh).geometry)
      })
      gltfGeometryCache.set(dataUrl, geos)
      gltfGeometryLoading.delete(dataUrl)
      resolve(geos)
    }, undefined, () => {
      gltfGeometryLoading.delete(dataUrl)
      resolve([])
    })
  })

  gltfGeometryLoading.set(dataUrl, loading)
  return loading
}

import { useSceneStore } from '../../store/scene-store'
import { useGraphStore } from '../../store/graph-store'
import { useAnimationStore } from '../../store/animation-store'
import { useEditorStore } from '../../store/editor-store'
import { evaluateFloatPort, evaluateColorPort, type EvalContext } from '../../graph-engine/evaluator'
import { getNodeDef } from '../../graph-engine/node-registry'
import { useEvaluatorStore } from '../../store/evaluator-store'
import { evaluatePathPosition } from '../../graph-engine/path-utils'
import type { CompiledMesh, CompiledGLTF, CompiledLight, CompiledCamera, CompiledPath, CompiledBackgroundShader } from '../../types/node-graph'

function toThreeColor(color?: unknown): string {
  const c = color as [number, number, number, number] | undefined
  if (!c) return '#ffffff'
  return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`
}

type TextureSlot = {
  nodeId: string
  dataUrl?: string
  flipY?: boolean
  noiseProps?: Record<string, unknown>
  normalFrom?: { dataUrl?: string; noiseProps?: Record<string, unknown> }
  normalStrength?: number
  normalSourceNodeId?: string
}

function generateNoiseCanvas(noiseProps: Record<string, unknown>): HTMLCanvasElement {
  const resolution = Math.round((noiseProps.resolution as number) ?? 256)
  const scale = (noiseProps.scale as number) ?? 4
  const detail = Math.max(1, Math.round((noiseProps.detail as number) ?? 4))
  const roughness = (noiseProps.roughness as number) ?? 0.5
  const noiseType = (noiseProps.noiseType as number) ?? 0
  // Snap scale to nearest integer — noise must tile exactly at the boundary for RepeatWrapping to work.
  const tileX = Math.max(1, Math.round(scale))
  const tileY = tileX
  const canvas = document.createElement('canvas')
  canvas.width = resolution; canvas.height = resolution
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(resolution, resolution)
  function hash(x: number, y: number) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123; return n - Math.floor(n) }
  // Tile only in X: wrap x lattice at period tx, leave y as-is
  // Tile in both X and Y — wrap lattice at tile period per octave
  function hashT(x: number, y: number, tx: number, ty: number) {
    return hash(((x % tx) + tx) % tx, ((y % ty) + ty) % ty)
  }
  function valueNoise(px: number, py: number, tx: number, ty: number) {
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
    return hashT(ix,iy,tx,ty)*(1-ux)*(1-uy)+hashT(ix+1,iy,tx,ty)*ux*(1-uy)+hashT(ix,iy+1,tx,ty)*(1-ux)*uy+hashT(ix+1,iy+1,tx,ty)*ux*uy
  }
  function noiseFbm(px: number, py: number) {
    let val=0,amp=1,freq=1,max=0
    for(let i=0;i<detail;i++){val+=valueNoise(px*freq,py*freq,tileX*freq,tileY*freq)*amp;max+=amp;amp*=roughness;freq*=2}
    return val/max
  }
  function ridgedFbm(px: number, py: number) {
    let val=0,amp=1,freq=1,max=0,prev=1
    for(let i=0;i<detail;i++){const n=1-Math.abs(valueNoise(px*freq,py*freq,tileX*freq,tileY*freq)*2-1);val+=n*n*amp*prev;prev=n*n;max+=amp;amp*=roughness;freq*=2}
    return max>0?val/max:0
  }
  function voronoiFbm(px: number, py: number) {
    let val=0,amp=1,freq=1,max=0
    for(let i=0;i<detail;i++){
      const tx=tileX*freq,ty=tileY*freq
      const gx=Math.floor(px*freq),gy=Math.floor(py*freq);let md=1e9
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const cx=((gx+dx)%tx+tx)%tx,cy=((gy+dy)%ty+ty)%ty
        const ox=hash(cx+0.5,cy),oy=hash(cx,cy+0.5)
        const nx=gx+dx+ox-px*freq,ny=gy+dy+oy-py*freq
        const d=Math.sqrt(nx*nx+ny*ny);if(d<md)md=d
      }
      val+=Math.min(1,md)*amp;max+=amp;amp*=roughness;freq*=2
    }
    return max>0?val/max:0
  }
  const fn = noiseType===2?voronoiFbm:noiseType===1?ridgedFbm:noiseFbm
  // Sample using tileX/tileY so canvas covers exactly one tile period — RepeatWrapping then seals the seam
  for(let j=0;j<resolution;j++)for(let i=0;i<resolution;i++){const v=Math.round(fn((i/resolution)*tileX,(j/resolution)*tileY)*255),idx=(j*resolution+i)*4;imageData.data[idx]=v;imageData.data[idx+1]=v;imageData.data[idx+2]=v;imageData.data[idx+3]=255}
  ctx.putImageData(imageData,0,0)
  return canvas
}


/** Derive a normal map from a height map canvas using Sobel gradient. */
function canvasToNormalMap(src: HTMLCanvasElement, strength: number = 3): THREE.CanvasTexture {
  const w = src.width, h = src.height
  const srcData = src.getContext('2d')!.getImageData(0, 0, w, h).data
  const dst = document.createElement('canvas')
  dst.width = w; dst.height = h
  const dstCtx = dst.getContext('2d')!
  const out = dstCtx.createImageData(w, h)
  const get = (x: number, y: number) => srcData[(((y % h) + h) % h * w + ((x % w) + w) % w) * 4] / 255
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Sobel 3×3
      const dx = (get(x+1,y-1) + 2*get(x+1,y) + get(x+1,y+1)) - (get(x-1,y-1) + 2*get(x-1,y) + get(x-1,y+1))
      const dy = (get(x-1,y+1) + 2*get(x,y+1) + get(x+1,y+1)) - (get(x-1,y-1) + 2*get(x,y-1) + get(x+1,y-1))
      const nx = -dx * strength, ny = -dy * strength, nz = 1
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz)
      const i = (y * w + x) * 4
      out.data[i]   = Math.round((nx/len * 0.5 + 0.5) * 255)
      out.data[i+1] = Math.round((ny/len * 0.5 + 0.5) * 255)
      out.data[i+2] = Math.round((nz/len * 0.5 + 0.5) * 255)
      out.data[i+3] = 255
    }
  }
  dstCtx.putImageData(out, 0, 0)
  const tex = new THREE.CanvasTexture(dst)
  tex.colorSpace = THREE.LinearSRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

// Uniform declarations prepended to every custom shader so users can use them without boilerplate
const UNIFORM_PREAMBLE = `\
uniform float uTime;
uniform vec2  uMouse;
uniform vec2  uResolution;
uniform float uFloat1;
uniform float uFloat2;
uniform float uFloat3;
uniform float uFloat4;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
`

const DEFAULT_VERT = `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const DEFAULT_FRAG = `varying vec2 vUv;
void main() {
  gl_FragColor = vec4(vUv, 0.5, 1.0);
}`

function ShaderMaterialObject({
  mp,
  loadedTextures,
}: {
  mp: Record<string, unknown>
  loadedTextures: Record<string, THREE.Texture>
}) {
  // Stable uniforms object — values updated imperatively in useFrame
  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uMouse:      { value: new THREE.Vector2() },
    uResolution: { value: new THREE.Vector2() },
    uFloat1:     { value: (mp.u1 as number) ?? 0 },
    uFloat2:     { value: (mp.u2 as number) ?? 0 },
    uFloat3:     { value: (mp.u3 as number) ?? 0 },
    uFloat4:     { value: (mp.u4 as number) ?? 0 },
    uTex1:       { value: null as THREE.Texture | null },
    uTex2:       { value: null as THREE.Texture | null },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  // Recreate ShaderMaterial only when shader code changes; preamble injects all uniform declarations
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   UNIFORM_PREAMBLE + ((mp.vertCode as string) || DEFAULT_VERT),
    fragmentShader: UNIFORM_PREAMBLE + ((mp.fragCode as string) || DEFAULT_FRAG),
    uniforms,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [mp.vertCode, mp.fragCode, uniforms])

  // Track latest mp via ref so useFrame always reads current float values
  // (avoids React render-cycle lag for per-frame animated uniforms)
  const mpRef = useRef(mp)
  mpRef.current = mp

  // Update texture uniforms when textures load
  useEffect(() => {
    uniforms.uTex1.value = loadedTextures['t1'] ?? null
    uniforms.uTex2.value = loadedTextures['t2'] ?? null
    mat.needsUpdate = true
  }, [loadedTextures, mat, uniforms])

  // Per-frame: time, mouse, resolution, float inputs
  useFrame(({ clock, mouse, viewport }) => {
    uniforms.uTime.value = clock.getElapsedTime()
    uniforms.uMouse.value.set(mouse.x * 0.5 + 0.5, mouse.y * 0.5 + 0.5)
    uniforms.uResolution.value.set(viewport.width, viewport.height)
    uniforms.uFloat1.value = (mpRef.current.u1 as number) ?? 0
    uniforms.uFloat2.value = (mpRef.current.u2 as number) ?? 0
    uniforms.uFloat3.value = (mpRef.current.u3 as number) ?? 0
    uniforms.uFloat4.value = (mpRef.current.u4 as number) ?? 0
  })

  return <primitive attach="material" object={mat} />
}

// Full-screen triangle: covers clip space [-1,1]×[-1,1] with a single triangle.
// Bypasses camera projection — position.xy maps directly to clip coordinates.
const FULLSCREEN_VERT = `varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

// Standard mesh vertex shader — passes UV and object-space position through.
const MESH_VERT = `varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

function MeshShaderGraphMaterial({ sg }: { sg: NonNullable<CompiledMesh['shaderGraph']> }) {
  const mat = useMemo(() => {
    const unis: Record<string, { value: unknown }> = {
      uTime:       { value: 0 },
      uMouse:      { value: new THREE.Vector2() },
      uResolution: { value: new THREE.Vector2() },
    }
    for (const [key, entry] of Object.entries(sg.uniforms)) {
      const v = entry.value
      unis[key] = { value: Array.isArray(v) && v.length === 3 ? new THREE.Vector3(v[0], v[1], v[2]) : v }
    }
    return new THREE.ShaderMaterial({
      vertexShader: sg.vertexShader ?? MESH_VERT,
      fragmentShader: sg.fragmentShader,
      uniforms: unis,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sg.fragmentShader, sg.vertexShader])

  useEffect(() => {
    for (const [key, entry] of Object.entries(sg.uniforms)) {
      if (!mat.uniforms[key]) continue
      const v = entry.value
      mat.uniforms[key].value = Array.isArray(v) && v.length === 3 ? new THREE.Vector3(v[0], v[1], v[2]) : v
    }
  }, [sg.uniforms, mat])

  const sgRef = useRef(sg)
  sgRef.current = sg
  const bridgeCache = useRef(new Map<string, number>())

  useFrame(({ mouse, viewport }, delta) => {
    const u = mat.uniforms
    const animStore = useAnimationStore.getState()
    u.uTime.value = animStore.elapsed
    ;(u.uMouse.value as THREE.Vector2).set(mouse.x * 0.5 + 0.5, mouse.y * 0.5 + 0.5)
    ;(u.uResolution.value as THREE.Vector2).set(viewport.width, viewport.height)
    const bridges = sgRef.current.bridgeUniforms
    if (bridges && Object.keys(bridges).length > 0) {
      const { nodes, edges } = useGraphStore.getState()
      const ctx: EvalContext = {
        elapsed: animStore.elapsed,
        delta: animStore.playing ? delta : 0,
        mouseX: mouse.x,
        mouseY: mouse.y,
        screenW: viewport.width,
        screenH: viewport.height,
      }
      bridgeCache.current.clear()
      for (const [uniformKey, evalKey] of Object.entries(bridges)) {
        if (!u[uniformKey]) continue
        const [srcNodeId, srcHandle] = evalKey.split(':')
        const val = evaluateFloatPort(srcNodeId, srcHandle, nodes, edges, ctx, bridgeCache.current)
        if (val !== undefined) u[uniformKey].value = val
      }
    }
  })

  return <primitive attach="material" object={mat} />
}

// PBR mode: MeshStandardMaterial + onBeforeCompile displacement injection.
// Keeps full Three.js PBR lighting, shadows, IBL — only vertex displacement is injected.
function MeshPBRShaderGraphMaterial({
  sg, mp, loadedTextures, matRef,
}: {
  sg: NonNullable<CompiledMesh['shaderGraph']>
  mp: Record<string, unknown>
  loadedTextures: Record<string, THREE.Texture>
  matRef: React.RefObject<THREE.MeshStandardMaterial>
}) {
  const sgRef = useRef(sg)
  sgRef.current = sg
  const bridgeCache = useRef(new Map<string, number>())
  // Ref to the shader object captured by onBeforeCompile for per-frame uniform updates
  const compiledShaderRef = useRef<{ uniforms: Record<string, { value: unknown }> } | null>(null)

  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: toThreeColor(mp.color) as THREE.ColorRepresentation,
      metalness: (mp.metalness as number) ?? 0.1,
      roughness: (mp.roughness as number) ?? 0.5,
      transparent: Boolean(mp.transparent),
      opacity: (mp.opacity as number) ?? 1,
      side: [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide][(mp.side as number) ?? 0],
    })
    if (sg.vertexPreamble && sg.vertexBodyForPBR) {
      m.onBeforeCompile = (shader) => {
        // Prepend noise library + uniform declarations
        shader.vertexShader = sgRef.current.vertexPreamble! + '\n' + shader.vertexShader
        // Inject displacement after Three.js built-in displacement
        shader.vertexShader = shader.vertexShader.replace(
          '#include <displacementmap_vertex>',
          `#include <displacementmap_vertex>\n${sgRef.current.vertexBodyForPBR!}`,
        )
        // Add initial uniform values
        for (const [key, entry] of Object.entries(sgRef.current.uniforms)) {
          const v = entry.value
          shader.uniforms[key] = { value: Array.isArray(v) && v.length === 3 ? new THREE.Vector3(v[0], v[1], v[2]) : v }
        }
        shader.uniforms.uTime       = { value: 0 }
        shader.uniforms.uMouse      = { value: new THREE.Vector2() }
        shader.uniforms.uResolution = { value: new THREE.Vector2() }
        compiledShaderRef.current = shader
      }
      m.needsUpdate = true
      m.customProgramCacheKey = () => (sg.vertexPreamble ?? '') + '|' + (sg.vertexBodyForPBR ?? '')
    }
    return m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sg.vertexBodyForPBR, sg.vertexPreamble])

  // Assign matRef so parent can call needsUpdate
  useEffect(() => {
    if (matRef && 'current' in matRef) (matRef as React.MutableRefObject<THREE.MeshStandardMaterial | null>).current = mat
  }, [mat, matRef])

  // Update non-shader material props imperatively
  useEffect(() => {
    mat.color.set(toThreeColor(mp.color) as THREE.ColorRepresentation)
    mat.metalness = (mp.metalness as number) ?? 0.1
    mat.roughness = (mp.roughness as number) ?? 0.5
  }, [mat, mp.color, mp.metalness, mp.roughness])

  // Update textures
  useEffect(() => {
    mat.map = loadedTextures.map ?? null
    mat.normalMap = loadedTextures.normalMap ?? null
    mat.roughnessMap = loadedTextures.roughnessMap ?? null
    mat.metalnessMap = loadedTextures.metalnessMap ?? null
    mat.aoMap = loadedTextures.aoMap ?? null
    mat.emissiveMap = loadedTextures.emissiveMap ?? null
    mat.displacementMap = loadedTextures.displacementMap ?? null
    mat.needsUpdate = true
  }, [mat, loadedTextures])

  // Update shader uniforms each frame
  useFrame(({ mouse, viewport }, delta) => {
    const shader = compiledShaderRef.current
    if (!shader) return
    const u = shader.uniforms
    const animStore = useAnimationStore.getState()
    if (u.uTime) u.uTime.value = animStore.elapsed
    if (u.uMouse) (u.uMouse.value as THREE.Vector2).set(mouse.x * 0.5 + 0.5, mouse.y * 0.5 + 0.5)
    if (u.uResolution) (u.uResolution.value as THREE.Vector2).set(viewport.width, viewport.height)
    // Live-update node uniform values
    for (const [key, entry] of Object.entries(sgRef.current.uniforms)) {
      if (!u[key]) continue
      const v = entry.value
      u[key].value = Array.isArray(v) && v.length === 3 ? new THREE.Vector3(v[0], v[1], v[2]) : v
    }
    // Bridge uniforms
    const bridges = sgRef.current.bridgeUniforms
    if (bridges && Object.keys(bridges).length > 0) {
      const { nodes, edges } = useGraphStore.getState()
      const ctx: EvalContext = {
        elapsed: animStore.elapsed, delta: animStore.playing ? delta : 0,
        mouseX: mouse.x, mouseY: mouse.y, screenW: viewport.width, screenH: viewport.height,
      }
      bridgeCache.current.clear()
      for (const [uniformKey, evalKey] of Object.entries(bridges)) {
        if (!u[uniformKey]) continue
        const [srcNodeId, srcHandle] = evalKey.split(':')
        const val = evaluateFloatPort(srcNodeId, srcHandle, nodes, edges, ctx, bridgeCache.current)
        if (val !== undefined) u[uniformKey].value = val
      }
    }
  })

  return <primitive attach="material" object={mat} />
}

function BackgroundShader({ bg }: { bg: CompiledBackgroundShader }) {
  const isGenerated = !!bg.generatedFragmentShader

  // Fragment shader: generated graph or raw GLSL
  const fragCode = bg.generatedFragmentShader
    ?? (UNIFORM_PREAMBLE + ((bg.materialProps.fragCode as string) || DEFAULT_FRAG))

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))
    return g
  }, [])

  // Recreate ShaderMaterial only when fragment shader code changes (topology change)
  const mat = useMemo(() => {
    const unis: Record<string, { value: unknown }> = {
      uTime:       { value: 0 },
      uMouse:      { value: new THREE.Vector2() },
      uResolution: { value: new THREE.Vector2() },
    }
    if (!isGenerated) {
      // Raw GLSL path: float and texture ports
      const mp = bg.materialProps
      unis.uFloat1 = { value: (mp.u1 as number) ?? 0 }
      unis.uFloat2 = { value: (mp.u2 as number) ?? 0 }
      unis.uFloat3 = { value: (mp.u3 as number) ?? 0 }
      unis.uFloat4 = { value: (mp.u4 as number) ?? 0 }
      unis.uTex1 = { value: null }
      unis.uTex2 = { value: null }
    }
    // Generated shader graph path: add node-specific uniforms with initial values
    if (bg.generatedUniforms) {
      for (const [key, entry] of Object.entries(bg.generatedUniforms)) {
        const v = entry.value
        unis[key] = {
          value: Array.isArray(v) && v.length === 3
            ? new THREE.Vector3(v[0], v[1], v[2])
            : v,
        }
      }
    }
    return new THREE.ShaderMaterial({
      vertexShader:   FULLSCREEN_VERT,
      fragmentShader: fragCode,
      uniforms:       unis,
      depthTest:      false,
      depthWrite:     false,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragCode])

  // Live-update node uniform values when properties change (no shader recompile)
  useEffect(() => {
    if (!bg.generatedUniforms) return
    for (const [key, entry] of Object.entries(bg.generatedUniforms)) {
      if (!mat.uniforms[key]) continue
      const v = entry.value
      mat.uniforms[key].value = Array.isArray(v) && v.length === 3
        ? new THREE.Vector3(v[0], v[1], v[2])
        : v
    }
  }, [bg.generatedUniforms, mat])

  const mpRef = useRef(bg.materialProps)
  mpRef.current = bg.materialProps
  const bgRef = useRef(bg)
  bgRef.current = bg
  // Per-frame eval cache for bridge uniforms (cleared each frame)
  const bridgeCache = useRef(new Map<string, number>())

  useFrame(({ mouse, viewport }, delta) => {
    const u = mat.uniforms
    const animStore = useAnimationStore.getState()
    // Read elapsed from animation store — LiveEvaluator owns advancement
    u.uTime.value = animStore.elapsed
    ;(u.uMouse.value as THREE.Vector2).set(mouse.x * 0.5 + 0.5, mouse.y * 0.5 + 0.5)
    ;(u.uResolution.value as THREE.Vector2).set(viewport.width, viewport.height)
    if (!isGenerated && u.uFloat1) {
      u.uFloat1.value = (mpRef.current.u1 as number) ?? 0
      u.uFloat2.value = (mpRef.current.u2 as number) ?? 0
      u.uFloat3.value = (mpRef.current.u3 as number) ?? 0
      u.uFloat4.value = (mpRef.current.u4 as number) ?? 0
    }
    // Bridge: evaluate CPU float nodes (time, math, input) at 60fps
    const bridges = bgRef.current.bridgeUniforms
    if (bridges && Object.keys(bridges).length > 0) {
      const { nodes, edges } = useGraphStore.getState()
      const ctx: EvalContext = {
        elapsed: animStore.elapsed,
        delta: animStore.playing ? delta : 0,
        mouseX: mouse.x,
        mouseY: mouse.y,
        screenW: viewport.width,
        screenH: viewport.height,
      }
      bridgeCache.current.clear()
      for (const [uniformKey, evalKey] of Object.entries(bridges)) {
        if (!u[uniformKey]) continue
        const [srcNodeId, srcHandle] = evalKey.split(':')
        const val = evaluateFloatPort(srcNodeId, srcHandle, nodes, edges, ctx, bridgeCache.current)
        if (val !== undefined) u[uniformKey].value = val
      }
    }
  })

  return (
    <mesh renderOrder={-1000} frustumCulled={false}>
      <primitive attach="geometry" object={geo} />
      <primitive attach="material" object={mat} />
    </mesh>
  )
}

function MeshObject({
  mesh,
  editorShading,
  isEditorView,
}: {
  mesh: CompiledMesh
  editorShading: boolean
  isEditorView: boolean
}) {
  const gp = mesh.geometryProps
  const mp = mesh.materialProps
  const t = mesh.transform

  const groupRef = useRef<THREE.Group>(null)
  const isDragging = useRef(false)

  // Load / generate all texture slots generically
  const textureSlots = (mp.textureSlots ?? {}) as Record<string, TextureSlot>
  const COLOR_SLOTS = new Set(['map', 'emissiveMap'])
  const slotKey = Object.entries(textureSlots)
    .map(([k, v]) => {
      if (v.normalFrom) {
        const src = v.normalFrom.dataUrl
          ? `img`
          : v.normalFrom.noiseProps
            ? `n:${v.normalFrom.noiseProps.noiseType}:${v.normalFrom.noiseProps.scale}:${v.normalFrom.noiseProps.detail}:${v.normalFrom.noiseProps.roughness}:${v.normalFrom.noiseProps.resolution}`
            : 'empty'
        return `${k}:normal:${src}:s${v.normalStrength ?? 3}`
      }
      if (v.dataUrl) return `${k}:img:${v.nodeId}`
      if (v.noiseProps) return `${k}:n:${v.noiseProps.noiseType}:${v.noiseProps.scale}:${v.noiseProps.detail}:${v.noiseProps.roughness}:${v.noiseProps.resolution}`
      return `${k}:${v.nodeId}`
    })
    .sort().join('|')
  const [loadedTextures, setLoadedTextures] = useState<Record<string, THREE.Texture>>({})
  useEffect(() => {
    const result: Record<string, THREE.Texture> = {}
    const imageLoads: Promise<void>[] = []
    let cancelled = false
    for (const [slot, data] of Object.entries(textureSlots)) {
      if (data.normalFrom) {
        // texture/normal node: generate/load source canvas then convert to normal map
        const strength = data.normalStrength ?? 3
        if (data.normalFrom.dataUrl) {
          imageLoads.push(new Promise<void>((resolve) => {
            new THREE.TextureLoader().load(data.normalFrom!.dataUrl!, (tex) => {
              const img = tex.image as HTMLImageElement
              const c = document.createElement('canvas')
              c.width = img.width; c.height = img.height
              c.getContext('2d')!.drawImage(img, 0, 0)
              tex.dispose()
              result[slot] = canvasToNormalMap(c, strength)
              resolve()
            })
          }))
        } else if (data.normalFrom.noiseProps) {
          const noiseCanvas = generateNoiseCanvas(data.normalFrom.noiseProps)
          result[slot] = canvasToNormalMap(noiseCanvas, strength)
        }
      } else if (data.dataUrl) {
        imageLoads.push(new Promise<void>((resolve) => {
          new THREE.TextureLoader().load(data.dataUrl!, (tex) => {
            // glTF-extracted textures have flipY:false — their UV coords are top-left
            // origin and the raw image data doesn't need flipping.
            if (data.flipY === false) tex.flipY = false
            tex.colorSpace = COLOR_SLOTS.has(slot) ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping
            result[slot] = tex
            resolve()
          })
        }))
      } else if (data.noiseProps) {
        const noiseCanvas = generateNoiseCanvas(data.noiseProps)
        const tex = new THREE.CanvasTexture(noiseCanvas)
        tex.colorSpace = COLOR_SLOTS.has(slot) ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping
        result[slot] = tex
      }
    }
    const apply = () => {
      if (cancelled) { Object.values(result).forEach(t => t.dispose()); return }
      setLoadedTextures(prev => { Object.values(prev).forEach(t => t.dispose()); return result })
    }
    if (imageLoads.length > 0) Promise.all(imageLoads).then(apply); else apply()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey])

  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  useEffect(() => { if (matRef.current) matRef.current.needsUpdate = true }, [loadedTextures])

  // gltf-mesh geometry: load asynchronously via cache, clone per instance
  const [gltfGeometry, setGltfGeometry] = useState<THREE.BufferGeometry | null>(null)
  useEffect(() => {
    if (mesh.geometryType !== 'gltf-mesh' || !mesh.geometrySource) return
    const { dataUrl, meshIndex, matrixWorld, extraFiles } = mesh.geometrySource
    let cancelled = false
    let cloned: THREE.BufferGeometry | null = null
    loadGltfGeometries(dataUrl, extraFiles).then((geos) => {
      if (cancelled) return
      const src = geos[meshIndex]
      if (src) {
        cloned = src.clone()
        // Apply the mesh's original world transform so parts appear at their correct positions
        if (matrixWorld) cloned.applyMatrix4(new THREE.Matrix4().fromArray(matrixWorld))
        setGltfGeometry(cloned)
      }
    })
    return () => {
      cancelled = true
      cloned?.dispose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh.geometryType, mesh.geometrySource?.dataUrl, mesh.geometrySource?.meshIndex])

  // Quad sphere geometry: built imperatively, memoized on radius+segments changes
  const quadSphereGeo = useMemo(() => {
    if (mesh.geometryType !== 'sphere') return null
    return createQuadSphere((gp.radius as number) ?? 0.5, (gp.segments as number) ?? 32)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh.geometryType, gp.radius, gp.segments])
  useEffect(() => () => { quadSphereGeo?.dispose() }, [quadSphereGeo])

  const wireframeOverride = useEditorStore((s) => editorShading && s.shadingMode === 'wireframe')
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
  const gizmoMode = useEditorStore((s) => s.gizmoMode)
  const isSelected = selectedNodeId === mesh.id
  const { controls } = useThree()

  // Sync group transform from compiled scene when not dragging
  useFrame(() => {
    if (!isDragging.current && groupRef.current) {
      groupRef.current.position.set(t.position[0], t.position[1], t.position[2])
      groupRef.current.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2])
      groupRef.current.scale.set(t.scale[0], t.scale[1], t.scale[2])
    }
  })

  // Always show gizmo when selected in editor — no transform node required
  const canGizmo = isEditorView && isSelected

  function handleDragStart() {
    isDragging.current = true
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false
  }

  function handleDragEnd() {
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true
    if (!groupRef.current) return

    const gs = useGraphStore.getState()
    const RAD2DEG = 180 / Math.PI
    const pos = groupRef.current.position
    const rot = groupRef.current.rotation
    const scale = groupRef.current.scale

    // Find existing transform node for this mode
    const modeIndex = gizmoMode === 'translate' ? 0 : gizmoMode === 'rotate' ? 1 : 2
    const transformNode = mesh.transformNodeIds
      .map((id) => gs.nodes.find((n) => n.id === id))
      .find((n) => n?.type === 'transform' && ((n.data.mode as number) ?? 0) === modeIndex)

    if (transformNode) {
      // Update existing transform node
      if (gizmoMode === 'translate') {
        gs.updateNodeData(transformNode.id, { tx: pos.x, ty: pos.y, tz: pos.z })
      } else if (gizmoMode === 'rotate') {
        gs.updateNodeData(transformNode.id, { rx: rot.x * RAD2DEG, ry: rot.y * RAD2DEG, rz: rot.z * RAD2DEG })
      } else if (gizmoMode === 'scale') {
        gs.updateNodeData(transformNode.id, { sx: scale.x, sy: scale.y, sz: scale.z })
      }
    } else {
      // Auto-create and insert a new transform node into the chain
      const baseData = { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 }
      const modeData =
        gizmoMode === 'translate' ? { mode: 0, tx: pos.x, ty: pos.y, tz: pos.z } :
        gizmoMode === 'rotate' ? { mode: 1, rx: rot.x * RAD2DEG, ry: rot.y * RAD2DEG, rz: rot.z * RAD2DEG } :
        { mode: 2, sx: scale.x, sy: scale.y, sz: scale.z }

      // Insert after the last node in the transform chain (or after the mesh itself)
      const lastId = mesh.transformNodeIds.length > 0
        ? mesh.transformNodeIds[mesh.transformNodeIds.length - 1]
        : mesh.id
      const outEdge = gs.edges.find((e) => e.source === lastId && e.sourceHandle === 'mesh')
      if (!outEdge) return

      const meshGraphNode = gs.nodes.find((n) => n.id === mesh.id)
      const newId = `transform-${Date.now()}`

      gs.removeEdge(outEdge.id)
      gs.addNode({
        id: newId,
        type: 'transform',
        position: { x: (meshGraphNode?.position.x ?? 0) + 220, y: meshGraphNode?.position.y ?? 0 },
        data: { ...baseData, ...modeData },
      })
      gs.addEdge({ id: `e-${lastId}-${newId}`, source: lastId, sourceHandle: 'mesh', target: newId, targetHandle: 'mesh' })
      gs.addEdge({ id: `e-${newId}-${outEdge.target}`, source: newId, sourceHandle: 'mesh', target: outEdge.target, targetHandle: outEdge.targetHandle })
    }

    // Wait 2 frames for the compiler to re-run before re-enabling position sync
    requestAnimationFrame(() => requestAnimationFrame(() => {
      isDragging.current = false
    }))
  }

  // Null object — only visible in editor as a small marker, never in camera view
  if (mesh.geometryType === 'null') {
    return (
      <>
        <group ref={groupRef}>
          {isEditorView && (
            <mesh
              renderOrder={999}
              onClick={(e) => { e.stopPropagation(); setSelectedNode(isSelected ? null : mesh.id) }}
            >
              <octahedronGeometry args={[0.15, 0]} />
              <meshBasicMaterial
                color={isSelected ? '#ff8800' : '#aaaaaa'}
                wireframe
                depthTest={false}
              />
            </mesh>
          )}
        </group>
        {canGizmo && (
          <TransformControls
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            object={groupRef as any}
            mode={gizmoMode}
            onMouseDown={handleDragStart}
            onMouseUp={handleDragEnd}
          />
        )}
      </>
    )
  }

  return (
    <>
      <group ref={groupRef}>
        <mesh
          castShadow
          receiveShadow
          onClick={(e) => {
            if (!isEditorView) return
            e.stopPropagation()
            setSelectedNode(isSelected ? null : mesh.id)
          }}
        >
          {mesh.geometryType === 'box' && (
            <boxGeometry args={[gp.width as number, gp.height as number, gp.depth as number, gp.widthSegs as number, gp.heightSegs as number, gp.depthSegs as number]} />
          )}
          {mesh.geometryType === 'sphere' && quadSphereGeo && (
            <primitive attach="geometry" object={quadSphereGeo} />
          )}
          {mesh.geometryType === 'plane' && (
            <planeGeometry args={[gp.width as number, gp.height as number, gp.widthSegs as number, gp.heightSegs as number]} />
          )}
          {mesh.geometryType === 'torus' && (
            <torusGeometry args={[gp.radius as number, gp.tube as number, gp.radialSegments as number, gp.tubularSegments as number]} />
          )}
          {mesh.geometryType === 'cylinder' && (
            <cylinderGeometry args={[gp.radiusTop as number, gp.radiusBottom as number, gp.height as number, gp.radialSegments as number]} />
          )}
          {mesh.geometryType === 'capsule' && (
            <capsuleGeometry args={[gp.radius as number, gp.length as number, gp.capSegments as number, gp.radialSegments as number]} />
          )}
          {mesh.geometryType === 'icosphere' && (
            <icosahedronGeometry args={[gp.radius as number, gp.detail as number]} />
          )}
          {mesh.geometryType === 'gltf-mesh' && (
            gltfGeometry
              ? <primitive attach="geometry" object={gltfGeometry} />
              : <boxGeometry args={[0.01, 0.01, 0.01]} />
          )}
          {mesh.shaderGraph?.pbrMode && !wireframeOverride ? (
            <MeshPBRShaderGraphMaterial sg={mesh.shaderGraph} mp={mp} loadedTextures={loadedTextures} matRef={matRef} />
          ) : mesh.materialType === 'shader/output' && mesh.shaderGraph && !wireframeOverride ? (
            <MeshShaderGraphMaterial sg={mesh.shaderGraph} />
          ) : mesh.materialType === 'shader/glsl' && !wireframeOverride ? (
            <ShaderMaterialObject mp={mp} loadedTextures={loadedTextures} />
          ) : wireframeOverride ? (
            <meshBasicMaterial color={toThreeColor(mp.color)} wireframe />
          ) : (
            <meshStandardMaterial
              ref={matRef}
              color={loadedTextures.map ? '#ffffff' : toThreeColor(mp.color)}
              map={loadedTextures.map ?? null}
              normalMap={loadedTextures.normalMap ?? null}
              normalScale={[(mp.normalScale as number) ?? 1, (mp.normalScale as number) ?? 1]}
              roughnessMap={loadedTextures.roughnessMap ?? null}
              metalnessMap={loadedTextures.metalnessMap ?? null}
              aoMap={loadedTextures.aoMap ?? null}
              aoMapIntensity={(mp.aoMapIntensity as number) ?? 1}
              emissiveMap={loadedTextures.emissiveMap ?? null}
              emissive={toThreeColor(mp.emissive)}
              emissiveIntensity={(mp.emissiveIntensity as number) ?? 1}
              displacementMap={loadedTextures.displacementMap ?? null}
              displacementScale={(mp.displacementScale as number) ?? 0.1}
              displacementBias={(mp.displacementBias as number) ?? 0}
              metalness={(mp.metalness as number) ?? 0.1}
              roughness={(mp.roughness as number) ?? 0.5}
              transparent={(mp.transparent as boolean) ?? false}
              opacity={(mp.opacity as number) ?? 1}
              side={((mp.side as number) ?? 0) as 0 | 1 | 2}
              wireframe={(mp.wireframe as boolean) ?? false}
            />
          )}
        </mesh>
        {/* Selection highlight overlay */}
        {isEditorView && isSelected && (mesh.geometryType !== 'gltf-mesh' || gltfGeometry) && (
          <mesh renderOrder={10}>
            {mesh.geometryType === 'box' && (
              <boxGeometry args={[gp.width as number, gp.height as number, gp.depth as number, gp.widthSegs as number, gp.heightSegs as number, gp.depthSegs as number]} />
            )}
            {mesh.geometryType === 'sphere' && quadSphereGeo && (
              <primitive attach="geometry" object={quadSphereGeo} />
            )}
            {mesh.geometryType === 'plane' && (
              <planeGeometry args={[gp.width as number, gp.height as number, gp.widthSegs as number, gp.heightSegs as number]} />
            )}
            {mesh.geometryType === 'torus' && (
              <torusGeometry args={[gp.radius as number, gp.tube as number, gp.radialSegments as number, gp.tubularSegments as number]} />
            )}
            {mesh.geometryType === 'cylinder' && (
              <cylinderGeometry args={[gp.radiusTop as number, gp.radiusBottom as number, gp.height as number, gp.radialSegments as number]} />
            )}
            {mesh.geometryType === 'capsule' && (
              <capsuleGeometry args={[gp.radius as number, gp.length as number, gp.capSegments as number, gp.radialSegments as number]} />
            )}
            {mesh.geometryType === 'icosphere' && (
              <icosahedronGeometry args={[gp.radius as number, gp.detail as number]} />
            )}
            {mesh.geometryType === 'gltf-mesh' && gltfGeometry && (
              <primitive attach="geometry" object={gltfGeometry} />
            )}
            <meshBasicMaterial color="#ff8800" wireframe depthTest={false} />
          </mesh>
        )}
      </group>
      {canGizmo && (
        <TransformControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          object={groupRef as any}
          mode={gizmoMode}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        />
      )}
    </>
  )
}

function LightObject({
  light,
  isEditorView,
  meshes,
}: {
  light: CompiledLight
  isEditorView: boolean
  meshes: import('../../types/node-graph').CompiledMesh[]
}) {
  const lp = light.props
  const color = toThreeColor(lp.color)
  const intensity = (lp.intensity as number) ?? 1
  const pos: [number, number, number] = [
    (lp.positionX as number) ?? 0,
    (lp.positionY as number) ?? 0,
    (lp.positionZ as number) ?? 0,
  ]

  // Resolve directional light target position
  const targetMesh = light.targetNodeId
    ? meshes.find((m) => m.id === light.targetNodeId)
    : undefined
  const targetPos: [number, number, number] = targetMesh?.transform.position ?? [0, 0, 0]

  const hasPosition = light.lightType !== 'ambient'

  const groupRef = useRef<THREE.Group>(null)
  const iconRef = useRef<THREE.Mesh>(null)
  const dirLightRef = useRef<THREE.DirectionalLight>(null)
  const areaLightRef = useRef<THREE.RectAreaLight | null>(null)
  const areaVisualRef = useRef<{ rect: THREE.LineSegments; arc: THREE.Line; mat: THREE.LineBasicMaterial } | null>(null)
  const isDragging = useRef(false)

  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
  const updateNodeData = useGraphStore((s) => s.updateNodeData)
  const isSelected = selectedNodeId === light.id
  const { controls } = useThree()

  useFrame(() => {
    if (hasPosition && !isDragging.current && groupRef.current) {
      groupRef.current.position.set(pos[0], pos[1], pos[2])
    }
    // Apply area light orientation + update visual color (selection state)
    if (isArea && groupRef.current) {
      if (light.targetNodeId && targetMesh) {
        // Target mode: orient -Z toward target position
        const lp2 = groupRef.current.position
        const dir = new THREE.Vector3(
          targetPos[0] - lp2.x,
          targetPos[1] - lp2.y,
          targetPos[2] - lp2.z,
        )
        if (dir.length() > 0.001) {
          // Area light emits in -Z; use lookAt then flip 180° around Y
          const mat4 = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir.normalize(), new THREE.Vector3(0, 1, 0))
          groupRef.current.quaternion.setFromRotationMatrix(mat4)
        }
      } else {
        groupRef.current.rotation.set(areaRotX, areaRotY, areaRotZ)
      }
      if (areaVisualRef.current) {
        areaVisualRef.current.mat.color.set(isSelected ? '#ff8800' : '#ffdd44')
      }
    }
    // Update directional light target position imperatively
    if (dirLightRef.current) {
      dirLightRef.current.target.position.set(targetPos[0], targetPos[1], targetPos[2])
      dirLightRef.current.target.updateMatrixWorld()
    }
    // Rotate directional cone to face toward target
    if (isEditorView && light.lightType === 'directional' && iconRef.current && groupRef.current) {
      const p = groupRef.current.position
      const dir = new THREE.Vector3(
        targetPos[0] - p.x,
        targetPos[1] - p.y,
        targetPos[2] - p.z,
      )
      if (dir.length() > 0.001) {
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, -1, 0),
          dir.normalize(),
        )
        iconRef.current.quaternion.copy(quat)
      }
    }
  })

  // Area light: create RectAreaLight + helper imperatively
  const isArea = light.lightType === 'area'
  const areaW = (lp.width as number) ?? 2
  const areaH = (lp.height as number) ?? 1
  const areaIntensity = (lp.intensity as number) ?? 5
  const areaRotX = ((lp.rotationX as number) ?? 0) * (Math.PI / 180)
  const areaRotY = ((lp.rotationY as number) ?? 0) * (Math.PI / 180)
  const areaRotZ = ((lp.rotationZ as number) ?? 0) * (Math.PI / 180)

  useEffect(() => {
    if (!isArea) return
    const group = groupRef.current
    if (!group) return

    // Actual light (both views)
    const al = new THREE.RectAreaLight(color, areaIntensity, areaW, areaH)
    areaLightRef.current = al
    group.add(al)

    // Editor-only visual: rect outline + emission arc (pure lines, no mesh)
    if (isEditorView) {
      const mat = new THREE.LineBasicMaterial({ color: '#ffdd44', depthTest: false })

      // Rectangle outline
      const hw = areaW / 2, hh = areaH / 2
      const rectGeo = new THREE.BufferGeometry()
      rectGeo.setAttribute('position', new THREE.Float32BufferAttribute([
        -hw, -hh, 0,  hw, -hh, 0,   // bottom
         hw, -hh, 0,  hw,  hh, 0,   // right
         hw,  hh, 0, -hw,  hh, 0,   // top
        -hw,  hh, 0, -hw, -hh, 0,   // left
        -hw, -hh, 0,  hw,  hh, 0,   // diagonal ↗
         hw, -hh, 0, -hw,  hh, 0,   // diagonal ↖
      ], 3))
      const rect = new THREE.LineSegments(rectGeo, mat)
      rect.renderOrder = 999
      group.add(rect)

      // Emission direction line: fixed length pointing -Z (not scaled with dimensions)
      const arcGeo = new THREE.BufferGeometry()
      arcGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -0.6], 3))
      const arc = new THREE.Line(arcGeo, mat)
      arc.renderOrder = 999
      group.add(arc)

      areaVisualRef.current = { rect, arc, mat }
    }

    return () => {
      if (areaLightRef.current) { group.remove(areaLightRef.current); areaLightRef.current = null }
      if (areaVisualRef.current) {
        const { rect, arc, mat } = areaVisualRef.current
        group.remove(rect); rect.geometry.dispose()
        group.remove(arc); arc.geometry.dispose()
        mat.dispose()
        areaVisualRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArea, isEditorView])

  // Sync area light properties + update visual geometry on dimension change
  useEffect(() => {
    const al = areaLightRef.current
    if (!al) return
    al.color.set(color)
    al.intensity = areaIntensity
    al.width = areaW
    al.height = areaH

    const vis = areaVisualRef.current
    if (!vis) return
    const hw = areaW / 2, hh = areaH / 2

    // Update rect geometry
    const rp = vis.rect.geometry.attributes.position as THREE.BufferAttribute
    const rectPts = [
      -hw,-hh,0, hw,-hh,0, hw,-hh,0, hw,hh,0, hw,hh,0, -hw,hh,0, -hw,hh,0, -hw,-hh,0,
      -hw,-hh,0, hw,hh,0, hw,-hh,0, -hw,hh,0,
    ]
    for (let i = 0; i < rectPts.length; i++) (rp.array as Float32Array)[i] = rectPts[i]
    rp.needsUpdate = true

    // Arc is a fixed-length line — no geometry update needed
  }, [color, areaIntensity, areaW, areaH])

  function handleDragStart() {
    isDragging.current = true
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false
  }

  function handleDragEnd() {
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true
    if (!groupRef.current) return
    const p = groupRef.current.position
    // Update graph store (triggers recompile for persistence)
    updateNodeData(light.id, { positionX: p.x, positionY: p.y, positionZ: p.z })
    // Also update scene store directly to avoid snap-back before compiler runs
    const scene = useSceneStore.getState().scene
    const newLights = scene.lights.map((l) =>
      l.id === light.id
        ? { ...l, props: { ...l.props, positionX: p.x, positionY: p.y, positionZ: p.z } }
        : l
    )
    useSceneStore.getState().setScene({ ...scene, lights: newLights })
    requestAnimationFrame(() => requestAnimationFrame(() => {
      isDragging.current = false
    }))
  }

  if (light.lightType === 'ambient') {
    // In editor view the canvas has its own fixed ambient — skip scene ambient
    if (isEditorView) return null
    return <ambientLight color={color} intensity={intensity} />
  }

  const iconColor = isSelected ? '#ff8800' : '#ffdd44'
  const iconScale = Math.max(0.5, Math.min(3.0, 0.8 + Math.sqrt(Math.max(0, intensity)) * 0.25))

  return (
    <>
      <group ref={groupRef} position={pos}>
        {/* Only render actual scene lights in camera view */}
        {!isEditorView && light.lightType === 'directional' && (
          <directionalLight
            ref={dirLightRef} color={color} intensity={intensity} castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-near={0.1} shadow-camera-far={50}
            shadow-camera-left={-12} shadow-camera-right={12}
            shadow-camera-top={12} shadow-camera-bottom={-12}
          />
        )}
        {!isEditorView && light.lightType === 'point' && (
          <pointLight color={color} intensity={intensity} distance={(lp.distance as number) ?? 0} castShadow shadow-mapSize={[1024, 1024]} />
        )}
        {/* Area light: RectAreaLight + RectAreaLightHelper added imperatively via useEffect */}
        {isEditorView && !isArea && (
          <mesh
            ref={iconRef}
            scale={iconScale}
            renderOrder={999}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedNode(isSelected ? null : light.id)
            }}
          >
            {light.lightType === 'point' && (
              <sphereGeometry args={[0.15, 8, 6]} />
            )}
            {light.lightType === 'directional' && (
              <coneGeometry args={[0.15, 0.35, 16]} />
            )}
            <meshBasicMaterial color={iconColor} wireframe depthTest={false} />
          </mesh>
        )}
        {/* Area light: invisible click target — visual (rect + arc) built imperatively */}
        {isArea && isEditorView && (
          <mesh
            onClick={(e) => { e.stopPropagation(); setSelectedNode(isSelected ? null : light.id) }}
          >
            <planeGeometry args={[areaW, areaH]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
      </group>
      {isEditorView && isSelected && (
        <TransformControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          object={groupRef as any}
          mode="translate"
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        />
      )}
    </>
  )
}

function CameraIcon({ camera }: { camera: CompiledCamera }) {
  const groupRef = useRef<THREE.Group>(null)
  const isDragging = useRef(false)

  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
  const gizmoMode = useEditorStore((s) => s.gizmoMode)
  const isSelected = selectedNodeId === camera.nodeId
  const { controls } = useThree()

  const DEG2RAD = Math.PI / 180
  const RAD2DEG = 180 / Math.PI

  useFrame(() => {
    if (!isDragging.current && groupRef.current) {
      groupRef.current.position.set(camera.position[0], camera.position[1], camera.position[2])
      if (camera.mode === 1 && camera.targetNodeId) {
        const scene = useSceneStore.getState().scene
        const target = scene.meshes.find((m) => m.id === camera.targetNodeId)
          ?? scene.gltfObjects.find((g) => g.id === camera.targetNodeId)
        if (target) {
          const [tx, ty, tz] = target.transform.position
          const p = groupRef.current.position
          // Look at the mirrored point so -Z (base) faces the target
          groupRef.current.lookAt(2 * p.x - tx, 2 * p.y - ty, 2 * p.z - tz)
        }
      } else {
        groupRef.current.rotation.set(
          camera.rotation[0] * DEG2RAD,
          camera.rotation[1] * DEG2RAD,
          camera.rotation[2] * DEG2RAD,
        )
      }
    }
  })

  function handleDragStart() {
    isDragging.current = true
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false
  }

  function handleDragEnd() {
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true
    if (!groupRef.current) return
    const p = groupRef.current.position
    const r = groupRef.current.rotation
    const gs = useGraphStore.getState()
    const scene = useSceneStore.getState().scene

    if (gizmoMode === 'translate') {
      gs.updateNodeData(camera.nodeId, { positionX: p.x, positionY: p.y, positionZ: p.z })
      if (scene.camera) {
        useSceneStore.getState().setScene({
          ...scene,
          camera: { ...scene.camera, position: [p.x, p.y, p.z] },
        })
      }
    } else if (gizmoMode === 'rotate') {
      gs.updateNodeData(camera.nodeId, {
        rotationX: r.x * RAD2DEG,
        rotationY: r.y * RAD2DEG,
        rotationZ: r.z * RAD2DEG,
      })
      if (scene.camera) {
        useSceneStore.getState().setScene({
          ...scene,
          camera: { ...scene.camera, rotation: [r.x * RAD2DEG, r.y * RAD2DEG, r.z * RAD2DEG] },
        })
      }
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      isDragging.current = false
    }))
  }

  return (
    <>
      <group ref={groupRef} position={camera.position}>
        <mesh
          renderOrder={999}
          rotation={[Math.PI / 2, Math.PI / 4, 0]}
          position={[0, 0, -0.08]}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedNode(isSelected ? null : camera.nodeId)
          }}
        >
          {/* Square pyramid — radius scales with FOV, base faces -Z (camera look direction) */}
          <coneGeometry args={[Math.max(0.05, Math.tan((camera.fov * Math.PI / 180) / 2) * 0.5), 0.35, 4]} />
          <meshBasicMaterial
            color={isSelected ? '#ff8800' : '#38BDF8'}
            depthTest={false}
            wireframe
          />
        </mesh>
      </group>
      {isSelected && (
        <TransformControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          object={groupRef as any}
          mode={gizmoMode === 'scale' ? 'translate' : gizmoMode}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        />
      )}
    </>
  )
}

/**
 * LiveEvaluator runs inside the R3F render loop.
 * Evaluates dynamic float connections and updates the compiled scene.
 */
function LiveEvaluator() {
  const mouseRef = useRef({ x: 0, y: 0 })
  const lastStoreUpdate = useRef(0)
  const { size } = useThree()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  useFrame((_, delta) => {
    const animStore = useAnimationStore.getState()
    const playing = animStore.playing

    let newElapsed = animStore.elapsed
    if (playing) {
      newElapsed += delta
      animStore.setElapsed(newElapsed)
    }

    const nodes = useGraphStore.getState().nodes
    const edges = useGraphStore.getState().edges
    const scene = useSceneStore.getState().scene

    const ctx: EvalContext = {
      elapsed: newElapsed,
      delta: playing ? delta : 0,
      mouseX: mouseRef.current.x,
      mouseY: mouseRef.current.y,
      screenW: size.width,
      screenH: size.height,
    }

    const cache = new Map<string, number>()
    const colorCache = new Map<string, [number, number, number, number]>()

    // Evaluate ALL float source ports so edge labels work
    for (const edge of edges) {
      const sourceNode = nodes.find((n) => n.id === edge.source)
      if (!sourceNode) continue
      if (sourceNode.type === 'time' || sourceNode.type === 'math' || sourceNode.type === 'input') {
        evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
      }
    }

    // Evaluate ALL color source ports so node previews and properties work
    for (const edge of edges) {
      const sourceNode = nodes.find((n) => n.id === edge.source)
      if (!sourceNode) continue
      if (sourceNode.type === 'color' || sourceNode.type === 'color/mix' || sourceNode.type === 'color/hsl') {
        const val = evaluateColorPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (val) colorCache.set(`${sourceNode.id}:${edge.sourceHandle}`, val)
      }
    }

    const hasDynamic = nodes.some(
      (n) => n.type === 'time' || n.type === 'input' || n.type === 'math',
    )
    const hasPath = !!scene.camera?.pathNodeId || scene.lights.some((l) => l.pathNodeId)
    if (!hasDynamic && !hasPath) {
      // Still update evaluator store for edge labels + color previews even when no dynamic nodes
      const now = performance.now()
      if ((cache.size > 0 || colorCache.size > 0) && now - lastStoreUpdate.current > 100) {
        lastStoreUpdate.current = now
        useEvaluatorStore.getState().setValues(cache, colorCache)
      }
      return
    }

    let changed = false
    const newMeshes = scene.meshes.map((mesh) => {
      let meshChanged = false
      const matProps = { ...mesh.materialProps }
      const geoProps = { ...mesh.geometryProps }
      const transform = { ...mesh.transform }

      const texSlots = mesh.materialProps.textureSlots as Record<string, TextureSlot> | undefined
      const texNodeIds = texSlots
        ? Object.values(texSlots).flatMap(s => [s.nodeId, ...(s.normalSourceNodeId ? [s.normalSourceNodeId] : [])])
        : []
      const ownedNodeIds = new Set([mesh.id, mesh.geometryNodeId, mesh.materialNodeId, ...mesh.transformNodeIds, ...texNodeIds])

      for (const edge of edges) {
        if (!ownedNodeIds.has(edge.target)) continue

        const sourceNode = nodes.find((n) => n.id === edge.source)
        if (!sourceNode) continue
        if (sourceNode.type !== 'time' && sourceNode.type !== 'math' && sourceNode.type !== 'input') continue

        const val = evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (val === undefined) continue

        const targetNode = nodes.find((n) => n.id === edge.target)
        if (!targetNode) continue

        if (targetNode.type === 'texture') {
          // Update matching slot's noiseProps (direct or via normalFrom) so canvas texture regenerates
          const slots = matProps.textureSlots as Record<string, TextureSlot> | undefined
          if (slots) {
            // Direct texture slot
            const direct = Object.entries(slots).find(([, s]) => s.nodeId === targetNode.id)
            if (direct) {
              const [slotName, slotData] = direct
              if (slotData.noiseProps && slotData.noiseProps[edge.targetHandle] !== val) {
                matProps.textureSlots = { ...slots, [slotName]: { ...slotData, noiseProps: { ...slotData.noiseProps, [edge.targetHandle]: val } } }
                meshChanged = true
              }
            }
            // texture/normal slot — upstream source
            const normalEntry = Object.entries(slots).find(([, s]) => s.normalSourceNodeId === targetNode.id)
            if (normalEntry) {
              const [slotName, slotData] = normalEntry
              if (slotData.normalFrom?.noiseProps && slotData.normalFrom.noiseProps[edge.targetHandle] !== val) {
                matProps.textureSlots = { ...slots, [slotName]: { ...slotData, normalFrom: { ...slotData.normalFrom, noiseProps: { ...slotData.normalFrom.noiseProps, [edge.targetHandle]: val } } } }
                meshChanged = true
              }
            }
          }
        } else if (targetNode.type === 'material' || targetNode.type === 'shader/glsl') {
          if (mesh.materialProps[edge.targetHandle] !== val) { matProps[edge.targetHandle] = val; meshChanged = true }
        } else if (targetNode.type === 'geometry') {
          if (mesh.geometryProps[edge.targetHandle] !== val) { geoProps[edge.targetHandle] = val; meshChanged = true }
        } else if (targetNode.type === 'transform') {
          const targetDef = getNodeDef(targetNode.type)
          const targetProps = { ...(targetDef?.defaults ?? {}), ...targetNode.data }
          const mode = (targetProps.mode as number) ?? 0
          const prop = edge.targetHandle

          if (mode === 0) {
            // Translate
            if (prop === 'x' && transform.position[0] !== val) { transform.position = [...transform.position]; transform.position[0] = val; meshChanged = true }
            if (prop === 'y' && transform.position[1] !== val) { transform.position = [...transform.position]; transform.position[1] = val; meshChanged = true }
            if (prop === 'z' && transform.position[2] !== val) { transform.position = [...transform.position]; transform.position[2] = val; meshChanged = true }
          } else if (mode === 1) {
            // Rotate
            const DEG2RAD = Math.PI / 180
            if (prop === 'x' && transform.rotation[0] !== val * DEG2RAD) { transform.rotation = [...transform.rotation]; transform.rotation[0] = val * DEG2RAD; meshChanged = true }
            if (prop === 'y' && transform.rotation[1] !== val * DEG2RAD) { transform.rotation = [...transform.rotation]; transform.rotation[1] = val * DEG2RAD; meshChanged = true }
            if (prop === 'z' && transform.rotation[2] !== val * DEG2RAD) { transform.rotation = [...transform.rotation]; transform.rotation[2] = val * DEG2RAD; meshChanged = true }
          } else if (mode === 2) {
            // Scale
            if (prop === 'x' && transform.scale[0] !== val) { transform.scale = [...transform.scale]; transform.scale[0] = val; meshChanged = true }
            if (prop === 'y' && transform.scale[1] !== val) { transform.scale = [...transform.scale]; transform.scale[1] = val; meshChanged = true }
            if (prop === 'z' && transform.scale[2] !== val) { transform.scale = [...transform.scale]; transform.scale[2] = val; meshChanged = true }
          }
        }
      }

      // Evaluate dynamic color port connections (color, color/mix, color/hsl)
      for (const edge of edges) {
        if (edge.target !== mesh.materialNodeId) continue
        if (edge.targetHandle !== 'color') continue
        const colorSrcNode = nodes.find((n) => n.id === edge.source)
        if (!colorSrcNode) continue

        const colorVal = evaluateColorPort(colorSrcNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (colorVal === undefined) continue
        const existing = matProps.color as [number, number, number, number] | undefined
        if (!existing || colorVal.some((v, i) => v !== existing[i])) {
          matProps.color = colorVal
          meshChanged = true
        }
      }

      if (meshChanged) {
        changed = true
        return { ...mesh, materialProps: matProps, geometryProps: geoProps, transform: transform as any }
      }
      return mesh
    })

    // Evaluate float inputs on background shader (u1-u4 ports)
    let newBgShader = scene.backgroundShader
    if (newBgShader) {
      const bgMatNodeId = newBgShader.materialNodeId
      const bgProps = { ...newBgShader.materialProps }
      let bgChanged = false
      for (const edge of edges) {
        if (edge.target !== bgMatNodeId) continue
        const sourceNode = nodes.find((n) => n.id === edge.source)
        if (!sourceNode) continue
        if (sourceNode.type !== 'time' && sourceNode.type !== 'math' && sourceNode.type !== 'input') continue
        const val = evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (val === undefined) continue
        if (bgProps[edge.targetHandle] !== val) { bgProps[edge.targetHandle] = val; bgChanged = true }
      }
      if (bgChanged) {
        changed = true
        newBgShader = { ...newBgShader, materialProps: bgProps }
      }
    }

    // Evaluate float inputs on gltf object transform nodes
    const newGltfObjects = scene.gltfObjects.map((gltf) => {
      let gltfChanged = false
      const transform = { ...gltf.transform }

      const ownedNodeIds = new Set([gltf.id, ...gltf.transformNodeIds])

      for (const edge of edges) {
        if (!ownedNodeIds.has(edge.target)) continue

        const sourceNode = nodes.find((n) => n.id === edge.source)
        if (!sourceNode) continue
        if (sourceNode.type !== 'time' && sourceNode.type !== 'math' && sourceNode.type !== 'input') continue

        const val = evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (val === undefined) continue

        const targetNode = nodes.find((n) => n.id === edge.target)
        if (!targetNode || targetNode.type !== 'transform') continue

        const targetDef = getNodeDef(targetNode.type)
        const targetProps = { ...(targetDef?.defaults ?? {}), ...targetNode.data }
        const mode = (targetProps.mode as number) ?? 0
        const prop = edge.targetHandle

        if (mode === 0) {
          if (prop === 'x' && transform.position[0] !== val) { transform.position = [...transform.position]; transform.position[0] = val; gltfChanged = true }
          if (prop === 'y' && transform.position[1] !== val) { transform.position = [...transform.position]; transform.position[1] = val; gltfChanged = true }
          if (prop === 'z' && transform.position[2] !== val) { transform.position = [...transform.position]; transform.position[2] = val; gltfChanged = true }
        } else if (mode === 1) {
          const DEG2RAD = Math.PI / 180
          if (prop === 'x' && transform.rotation[0] !== val * DEG2RAD) { transform.rotation = [...transform.rotation]; transform.rotation[0] = val * DEG2RAD; gltfChanged = true }
          if (prop === 'y' && transform.rotation[1] !== val * DEG2RAD) { transform.rotation = [...transform.rotation]; transform.rotation[1] = val * DEG2RAD; gltfChanged = true }
          if (prop === 'z' && transform.rotation[2] !== val * DEG2RAD) { transform.rotation = [...transform.rotation]; transform.rotation[2] = val * DEG2RAD; gltfChanged = true }
        } else if (mode === 2) {
          if (prop === 'x' && transform.scale[0] !== val) { transform.scale = [...transform.scale]; transform.scale[0] = val; gltfChanged = true }
          if (prop === 'y' && transform.scale[1] !== val) { transform.scale = [...transform.scale]; transform.scale[1] = val; gltfChanged = true }
          if (prop === 'z' && transform.scale[2] !== val) { transform.scale = [...transform.scale]; transform.scale[2] = val; gltfChanged = true }
        }
      }

      if (gltfChanged) {
        changed = true
        return { ...gltf, transform: transform as any }
      }
      return gltf
    })

    // Evaluate float inputs on light nodes
    const newLights = scene.lights.map((light) => {
      let lightChanged = false
      const props = { ...light.props }

      let pathProgress = light.pathProgress ?? 0

      for (const edge of edges) {
        if (edge.target !== light.id) continue

        const sourceNode = nodes.find((n) => n.id === edge.source)
        if (!sourceNode) continue
        if (sourceNode.type !== 'time' && sourceNode.type !== 'math' && sourceNode.type !== 'input') continue

        const val = evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (val === undefined) continue

        if (edge.targetHandle === 'pathProgress') {
          pathProgress = val
        } else if (light.props[edge.targetHandle as string] !== val) {
          props[edge.targetHandle] = val
          lightChanged = true
        }
      }

      // Apply path position for lights
      let updatedLight = lightChanged ? { ...light, props } : light
      if (light.pathNodeId) {
        const lightPath = scene.paths.find((p) => p.id === light.pathNodeId)
        if (lightPath) {
          const pos = evaluatePathPosition(lightPath, pathProgress)
          if (pos[0] !== updatedLight.props.positionX || pos[1] !== updatedLight.props.positionY || pos[2] !== updatedLight.props.positionZ) {
            updatedLight = { ...updatedLight, props: { ...updatedLight.props, positionX: pos[0], positionY: pos[1], positionZ: pos[2] }, pathProgress }
            lightChanged = true
          }
          // Push real world position + path rotation into evaluator store for PropertiesPanel/port display
          cache.set(`${light.id}:positionX`, pos[0])
          cache.set(`${light.id}:positionY`, pos[1])
          cache.set(`${light.id}:positionZ`, pos[2])
          cache.set(`${light.id}:rotationX`, (lightPath.pathProps.rotationX as number) ?? 0)
          cache.set(`${light.id}:rotationY`, (lightPath.pathProps.rotationY as number) ?? 0)
          cache.set(`${light.id}:rotationZ`, (lightPath.pathProps.rotationZ as number) ?? 0)
        }
      }

      if (lightChanged) {
        changed = true
        return updatedLight
      }
      return light
    })

    // Evaluate float inputs on camera node
    let newCamera = scene.camera
    if (scene.camera) {
      const camNodeId = scene.camera.nodeId
      let camChanged = false
      const camPos: [number, number, number] = [...scene.camera.position]
      const camRot: [number, number, number] = [...scene.camera.rotation]
      let camFov = scene.camera.fov

      for (const edge of edges) {
        if (edge.target !== camNodeId) continue
        const sourceNode = nodes.find((n) => n.id === edge.source)
        if (!sourceNode) continue
        if (sourceNode.type !== 'time' && sourceNode.type !== 'math' && sourceNode.type !== 'input') continue

        const val = evaluateFloatPort(sourceNode.id, edge.sourceHandle, nodes, edges, ctx, cache)
        if (val === undefined) continue

        camChanged = true
        switch (edge.targetHandle) {
          case 'positionX': camPos[0] = val; break
          case 'positionY': camPos[1] = val; break
          case 'positionZ': camPos[2] = val; break
          case 'rotationX': camRot[0] = val; break
          case 'rotationY': camRot[1] = val; break
          case 'rotationZ': camRot[2] = val; break
          case 'fov': camFov = val; break
          case 'pathProgress':
            if (scene.camera!.pathNodeId && scene.camera!.pathProgress !== val) {
              newCamera = { ...(newCamera ?? scene.camera!), pathProgress: val }
              camChanged = true
            }
            break
        }
      }

      if (camChanged) {
        changed = true
        newCamera = { ...(newCamera ?? scene.camera!), position: camPos, rotation: camRot, fov: camFov }
      }

      // Apply path position when a path is connected
      if (newCamera?.pathNodeId) {
        const camPath = scene.paths.find((p) => p.id === newCamera!.pathNodeId)
        if (camPath) {
          const t = newCamera.pathProgress ?? 0
          const pos = evaluatePathPosition(camPath, t)
          let pathCamChanged = pos[0] !== newCamera.position[0] || pos[1] !== newCamera.position[1] || pos[2] !== newCamera.position[2]
          let pathRot: [number, number, number] = newCamera.rotation

          // pathLookAhead orientation is handled entirely by CameraPathLookAhead
          // in CameraView.tsx via per-frame quaternion override. Do NOT compute or
          // store euler here: the plane-normal lookAt decomposition is discontinuous
          // for XY/YZ circles and overwrites the quaternion before gl.render().

          if (pathCamChanged) {
            changed = true
            newCamera = { ...newCamera, position: pos, rotation: pathRot }
          }
          // Push real world position + path rotation into evaluator store for PropertiesPanel/port display
          cache.set(`${scene.camera!.nodeId}:positionX`, pos[0])
          cache.set(`${scene.camera!.nodeId}:positionY`, pos[1])
          cache.set(`${scene.camera!.nodeId}:positionZ`, pos[2])
          cache.set(`${scene.camera!.nodeId}:rotationX`, (camPath.pathProps.rotationX as number) ?? 0)
          cache.set(`${scene.camera!.nodeId}:rotationY`, (camPath.pathProps.rotationY as number) ?? 0)
          cache.set(`${scene.camera!.nodeId}:rotationZ`, (camPath.pathProps.rotationZ as number) ?? 0)
        }
      }
    }

    // Evaluate Transform chains for path nodes — applies position + rotation from Transform nodes
    const newPaths = scene.paths.map((path) => {
      const transformIds = path.transformNodeIds ?? []
      if (transformIds.length === 0) return path

      const pos: [number, number, number] = [0, 0, 0]
      const rot = { x: 0, y: 0, z: 0 }

      for (const transformId of transformIds) {
        const tNode = nodes.find((n) => n.id === transformId)
        if (!tNode) continue
        const tMode = (tNode.data.mode as number) ?? 0

        if (tMode === 0) {
          // Translate — read tx/ty/tz, possibly overridden by connected float ports
          let tx = (tNode.data.tx as number) ?? 0
          let ty = (tNode.data.ty as number) ?? 0
          let tz = (tNode.data.tz as number) ?? 0
          for (const edge of edges) {
            if (edge.target !== transformId) continue
            const src = nodes.find((n) => n.id === edge.source)
            if (!src || (src.type !== 'time' && src.type !== 'math' && src.type !== 'input')) continue
            const val = evaluateFloatPort(src.id, edge.sourceHandle, nodes, edges, ctx, cache)
            if (val === undefined) continue
            if (edge.targetHandle === 'x') tx = val
            if (edge.targetHandle === 'y') ty = val
            if (edge.targetHandle === 'z') tz = val
          }
          pos[0] += tx; pos[1] += ty; pos[2] += tz
        } else if (tMode === 1) {
          // Rotate — read rx/ry/rz (degrees), possibly overridden by connected float ports
          let rx = (tNode.data.rx as number) ?? 0
          let ry = (tNode.data.ry as number) ?? 0
          let rz = (tNode.data.rz as number) ?? 0
          for (const edge of edges) {
            if (edge.target !== transformId) continue
            const src = nodes.find((n) => n.id === edge.source)
            if (!src || (src.type !== 'time' && src.type !== 'math' && src.type !== 'input')) continue
            const val = evaluateFloatPort(src.id, edge.sourceHandle, nodes, edges, ctx, cache)
            if (val === undefined) continue
            if (edge.targetHandle === 'x') rx = val
            if (edge.targetHandle === 'y') ry = val
            if (edge.targetHandle === 'z') rz = val
          }
          rot.x += rx; rot.y += ry; rot.z += rz
        }
      }

      const posChanged = pos[0] !== path.position[0] || pos[1] !== path.position[1] || pos[2] !== path.position[2]
      const rotChanged = rot.x !== ((path.pathProps.rotationX as number) ?? 0)
        || rot.y !== ((path.pathProps.rotationY as number) ?? 0)
        || rot.z !== ((path.pathProps.rotationZ as number) ?? 0)

      if (posChanged || rotChanged) changed = true

      return (posChanged || rotChanged)
        ? { ...path, position: pos, pathProps: { ...path.pathProps, rotationX: rot.x, rotationY: rot.y, rotationZ: rot.z } }
        : path
    })

    if (changed) {
      useSceneStore.getState().setScene({ ...scene, meshes: newMeshes, gltfObjects: newGltfObjects, paths: newPaths, lights: newLights, camera: newCamera, backgroundShader: newBgShader })
    }

    // Throttled update of evaluator store for edge labels + path positions (~10fps)
    const now = performance.now()
    if ((cache.size > 0 || colorCache.size > 0) && now - lastStoreUpdate.current > 100) {
      lastStoreUpdate.current = now
      useEvaluatorStore.getState().setValues(cache, colorCache)
    }
  })

  return null
}

export { LiveEvaluator }

function EnvironmentLoader() {
  const envMapDataUrl = useSceneStore((s) => s.scene.envMapDataUrl)
  const envIntensity = useSceneStore((s) => s.scene.envIntensity)
  const showEnvBackground = useSceneStore((s) => s.scene.showEnvBackground)
  const { gl, scene: threeScene } = useThree()
  const envMapRef = useRef<THREE.Texture | null>(null)
  // Ref so cleanup/async callbacks always read the latest value (not stale closure)
  const showEnvBgRef = useRef(showEnvBackground)
  useEffect(() => { showEnvBgRef.current = showEnvBackground }, [showEnvBackground])

  // Load / reload when file changes
  useEffect(() => {
    if (envMapRef.current) { envMapRef.current.dispose(); envMapRef.current = null }
    threeScene.environment = null
    // Only clear background when EnvironmentLoader owns it (showEnvBackground active).
    // When showEnvBackground is off, the declarative <color> element in CameraBackground /
    // EditorBackground owns the background — don't interfere.
    if (showEnvBgRef.current) threeScene.background = null
    gl.toneMapping = THREE.NoToneMapping
    gl.toneMappingExposure = 1
    if (!envMapDataUrl) return

    let cancelled = false
    const pmremGen = new THREE.PMREMGenerator(gl)
    pmremGen.compileEquirectangularShader()
    const loader = new RGBELoader()
    loader.load(envMapDataUrl, (texture) => {
      if (cancelled) { texture.dispose(); pmremGen.dispose(); return }
      const rt = pmremGen.fromEquirectangular(texture)
      envMapRef.current = rt.texture
      threeScene.environment = rt.texture
      threeScene.environmentIntensity = envIntensity
      if (showEnvBgRef.current) threeScene.background = rt.texture
      gl.toneMapping = THREE.ACESFilmicToneMapping
      gl.toneMappingExposure = 1
      texture.dispose()
      pmremGen.dispose()
    })
    return () => {
      cancelled = true
      if (envMapRef.current) { envMapRef.current.dispose(); envMapRef.current = null }
      threeScene.environment = null
      if (showEnvBgRef.current) threeScene.background = null
      gl.toneMapping = THREE.NoToneMapping
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envMapDataUrl])

  // Update intensity live without reload
  useEffect(() => {
    if (threeScene.environment) threeScene.environmentIntensity = envIntensity
  }, [envIntensity, threeScene])

  // Toggle background without reload
  useEffect(() => {
    if (!threeScene.environment) return
    threeScene.background = showEnvBackground ? threeScene.environment : null
  }, [showEnvBackground, threeScene])

  return null
}

function GltfObject({
  gltf,
  editorShading,
  isEditorView,
  smoothShading,
}: {
  gltf: CompiledGLTF
  editorShading: boolean
  isEditorView: boolean
  smoothShading: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const pivotRef = useRef<THREE.Group>(null)
  const loadedRef = useRef<THREE.Group | null>(null)
  const isDragging = useRef(false)
  const rawBboxCenter = useRef<THREE.Vector3 | null>(null)
  const rawBboxMin = useRef<THREE.Vector3 | null>(null)
  // Incremented after each successful load to trigger the shading effect
  const [smoothVersion, setSmoothVersion] = useState(0)
  const t = gltf.transform

  // Cross-shaped canvas texture for origin indicator (created once)
  const crossTex = useMemo(() => {
    const s = 32
    const canvas = document.createElement('canvas')
    canvas.width = s; canvas.height = s
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(5, s / 2); ctx.lineTo(s - 5, s / 2)
    ctx.moveTo(s / 2, 5); ctx.lineTo(s / 2, s - 5)
    ctx.stroke()
    return new THREE.CanvasTexture(canvas)
  }, [])

  const wireframeOverride = useEditorStore((s) => editorShading && s.shadingMode === 'wireframe')
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
  const gizmoMode = useEditorStore((s) => s.gizmoMode)
  const isSelected = selectedNodeId === gltf.id
  const { controls } = useThree()

  const wireframeOverrideRef = useRef(wireframeOverride)
  wireframeOverrideRef.current = wireframeOverride

  function applyWireframeToScene(scene: THREE.Group, wf: boolean) {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material
        const set = (m: THREE.Material) => {
          if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial) {
            m.wireframe = wf
          }
        }
        if (Array.isArray(mat)) mat.forEach(set)
        else set(mat)
      }
    })
  }

  // Always-fresh centering params — avoids stale closures in async callbacks
  const centeringRef = useRef({ centerMode: gltf.centerMode, originX: gltf.originX, originY: gltf.originY, originZ: gltf.originZ })
  centeringRef.current = { centerMode: gltf.centerMode, originX: gltf.originX, originY: gltf.originY, originZ: gltf.originZ }

  // Apply centering using cached raw bbox (computed before scene is added to any parent)
  function applyCenterToScene(scene: THREE.Group) {
    const { centerMode, originX, originY, originZ } = centeringRef.current
    scene.position.set(0, 0, 0)
    if (centerMode === 1 && rawBboxCenter.current) {
      const c = rawBboxCenter.current
      scene.position.set(-c.x, -c.y, -c.z)
    } else if (centerMode === 2 && rawBboxCenter.current && rawBboxMin.current) {
      const c = rawBboxCenter.current
      scene.position.set(-c.x, -rawBboxMin.current.y, -c.z)
    } else if (centerMode === 3) {
      scene.position.set(-originX, -originY, -originZ)
    }
  }

  // Load GLB/GLTF only when fileDataUrl changes
  useEffect(() => {
    if (!gltf.fileDataUrl || !groupRef.current) return
    let cancelled = false

    const manager = new THREE.LoadingManager()

    // For multi-file .gltf: map relative filenames → data URLs
    if (gltf.extraFiles && gltf.extraFiles.length > 0) {
      const urlMap = new Map(gltf.extraFiles.map((f) => [f.name, f.dataUrl]))
      manager.setURLModifier((url) => {
        const filename = url.split('/').pop()?.split('?')[0] ?? ''
        return urlMap.get(filename) ?? url
      })
    }

    const loader = new GLTFLoader(manager)
    loader.load(gltf.fileDataUrl, (result) => {
      if (cancelled || !groupRef.current) return
      if (loadedRef.current) groupRef.current.remove(loadedRef.current)

      // Compute raw bbox BEFORE adding to parent — keeps it in scene-local space
      result.scene.position.set(0, 0, 0)
      result.scene.updateMatrixWorld(true)
      const rawBox = new THREE.Box3().setFromObject(result.scene, true)
      if (!rawBox.isEmpty()) {
        rawBboxCenter.current = rawBox.getCenter(new THREE.Vector3())
        rawBboxMin.current = rawBox.min.clone()
      } else {
        rawBboxCenter.current = null
        rawBboxMin.current = null
      }

      loadedRef.current = result.scene
      groupRef.current.add(result.scene)
      applyCenterToScene(result.scene)
      applyWireframeToScene(result.scene, wireframeOverrideRef.current)
      setSmoothVersion((v) => v + 1)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.fileDataUrl])

  // Re-center without reloading when mode or manual origin changes
  useEffect(() => {
    if (!loadedRef.current) return
    applyCenterToScene(loadedRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.centerMode, gltf.originX, gltf.originY, gltf.originZ])

  // Apply smooth shading after load or when toggle changes
  useEffect(() => {
    if (!loadedRef.current) return
    loadedRef.current.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((m) => {
        (m as THREE.MeshStandardMaterial).flatShading = !smoothShading
        m.needsUpdate = true
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smoothShading, smoothVersion])

  // Apply wireframe override only when shadingMode changes
  useEffect(() => {
    if (!loadedRef.current) return
    applyWireframeToScene(loadedRef.current, wireframeOverride)
  }, [wireframeOverride])

  // Sync transform from compiled scene
  useFrame(() => {
    if (!isDragging.current && groupRef.current) {
      groupRef.current.position.set(t.position[0], t.position[1], t.position[2])
      groupRef.current.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2])
      groupRef.current.scale.set(t.scale[0], t.scale[1], t.scale[2])
    }
  })

  function handleDragStart() {
    isDragging.current = true
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false
  }

  function handleDragEnd() {
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true
    if (!groupRef.current) return

    const gs = useGraphStore.getState()
    const RAD2DEG = 180 / Math.PI
    const pos = groupRef.current.position
    const rot = groupRef.current.rotation
    const scale = groupRef.current.scale

    const modeIndex = gizmoMode === 'translate' ? 0 : gizmoMode === 'rotate' ? 1 : 2
    const transformNode = gltf.transformNodeIds
      .map((id) => gs.nodes.find((n) => n.id === id))
      .find((n) => n?.type === 'transform' && ((n.data.mode as number) ?? 0) === modeIndex)

    if (transformNode) {
      if (gizmoMode === 'translate') {
        gs.updateNodeData(transformNode.id, { tx: pos.x, ty: pos.y, tz: pos.z })
      } else if (gizmoMode === 'rotate') {
        gs.updateNodeData(transformNode.id, { rx: rot.x * RAD2DEG, ry: rot.y * RAD2DEG, rz: rot.z * RAD2DEG })
      } else if (gizmoMode === 'scale') {
        gs.updateNodeData(transformNode.id, { sx: scale.x, sy: scale.y, sz: scale.z })
      }
    } else {
      const baseData = { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 }
      const modeData =
        gizmoMode === 'translate' ? { mode: 0, tx: pos.x, ty: pos.y, tz: pos.z } :
        gizmoMode === 'rotate' ? { mode: 1, rx: rot.x * RAD2DEG, ry: rot.y * RAD2DEG, rz: rot.z * RAD2DEG } :
        { mode: 2, sx: scale.x, sy: scale.y, sz: scale.z }

      const lastId = gltf.transformNodeIds.length > 0
        ? gltf.transformNodeIds[gltf.transformNodeIds.length - 1]
        : gltf.id
      const outEdge = gs.edges.find((e) => e.source === lastId && e.sourceHandle === 'mesh')
      if (!outEdge) return

      const gltfGraphNode = gs.nodes.find((n) => n.id === gltf.id)
      const newId = `transform-${Date.now()}`

      gs.removeEdge(outEdge.id)
      gs.addNode({
        id: newId,
        type: 'transform',
        position: { x: (gltfGraphNode?.position.x ?? 0) + 220, y: gltfGraphNode?.position.y ?? 0 },
        data: { ...baseData, ...modeData },
      })
      gs.addEdge({ id: `e-${lastId}-${newId}`, source: lastId, sourceHandle: 'mesh', target: newId, targetHandle: 'mesh' })
      gs.addEdge({ id: `e-${newId}-${outEdge.target}`, source: newId, sourceHandle: 'mesh', target: outEdge.target, targetHandle: outEdge.targetHandle })
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
      isDragging.current = false
    }))
  }

  const canGizmo = isEditorView && isSelected

  return (
    <>
      <group
        ref={groupRef}
        onClick={(e) => {
          if (!isEditorView) return
          e.stopPropagation()
          setSelectedNode(isSelected ? null : gltf.id)
        }}
      >
        {/* Origin indicator — fixed screen-space cross, always visible in editor */}
        <group ref={pivotRef}>
          {isEditorView && (
            <points renderOrder={999}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[new Float32Array([0, 0, 0]), 3]} />
              </bufferGeometry>
              <pointsMaterial
                size={14}
                sizeAttenuation={false}
                color="#ff3300"
                map={crossTex}
                transparent
                alphaTest={0.1}
                depthTest={false}
              />
            </points>
          )}
        </group>
      </group>
      {canGizmo && (
        <TransformControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          object={groupRef as any}
          mode={gizmoMode}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        />
      )}
    </>
  )
}

function PathObject({ path }: { path: CompiledPath }) {
  const groupRef = useRef<THREE.Group>(null)
  const isDragging = useRef(false)
  const { controls } = useThree()

  const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
  const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
  const gizmoMode = useEditorStore((s) => s.gizmoMode)
  const isSelected = selectedNodeId === path.id

  const DEG2RAD = Math.PI / 180
  const RAD2DEG = 180 / Math.PI

  useFrame(() => {
    if (!isDragging.current && groupRef.current) {
      groupRef.current.position.set(path.position[0], path.position[1], path.position[2])
      groupRef.current.rotation.set(
        ((path.pathProps.rotationX as number) ?? 0) * DEG2RAD,
        ((path.pathProps.rotationY as number) ?? 0) * DEG2RAD,
        ((path.pathProps.rotationZ as number) ?? 0) * DEG2RAD,
      )
    }
  })

  function handleDragStart() {
    isDragging.current = true
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false
  }

  function handleDragEnd() {
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true
    if (!groupRef.current) return

    const gs = useGraphStore.getState()
    const pos = groupRef.current.position
    const rot = groupRef.current.rotation
    const modeIndex = gizmoMode === 'translate' ? 0 : gizmoMode === 'rotate' ? 1 : 0

    // Find existing Transform node for this mode in the path's transform chain
    const transformNode = (path.transformNodeIds ?? [])
      .map((id) => gs.nodes.find((n) => n.id === id))
      .find((n) => n?.type === 'transform' && ((n.data.mode as number) ?? 0) === modeIndex)

    if (transformNode) {
      if (gizmoMode === 'translate') {
        gs.updateNodeData(transformNode.id, { tx: pos.x, ty: pos.y, tz: pos.z })
      } else if (gizmoMode === 'rotate') {
        gs.updateNodeData(transformNode.id, { rx: rot.x * RAD2DEG, ry: rot.y * RAD2DEG, rz: rot.z * RAD2DEG })
      }
    } else {
      // Auto-create and insert a new Transform node into the path chain
      const baseData = { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 }
      const modeData =
        gizmoMode === 'translate' ? { mode: 0, tx: pos.x, ty: pos.y, tz: pos.z } :
        gizmoMode === 'rotate' ? { mode: 1, rx: rot.x * RAD2DEG, ry: rot.y * RAD2DEG, rz: rot.z * RAD2DEG } :
        { mode: 0, tx: pos.x, ty: pos.y, tz: pos.z }

      // Insert after the last node in the transform chain (or after the path itself)
      const lastId = (path.transformNodeIds ?? []).length > 0
        ? path.transformNodeIds[path.transformNodeIds.length - 1]
        : path.id
      const outEdge = gs.edges.find((e) => e.source === lastId && e.sourceHandle === 'path')
      const pathGraphNode = gs.nodes.find((n) => n.id === path.id)
      const newId = `transform-${Date.now()}`

      if (outEdge) gs.removeEdge(outEdge.id)
      gs.addNode({
        id: newId,
        type: 'transform',
        position: { x: (pathGraphNode?.position.x ?? 0) + 220, y: pathGraphNode?.position.y ?? 0 },
        data: { ...baseData, ...modeData },
      })
      gs.addEdge({ id: `e-${lastId}-${newId}`, source: lastId, sourceHandle: 'path', target: newId, targetHandle: 'path' })
      if (outEdge) {
        gs.addEdge({ id: `e-${newId}-${outEdge.target}`, source: newId, sourceHandle: 'path', target: outEdge.target, targetHandle: outEdge.targetHandle })
      }
    }

    requestAnimationFrame(() => requestAnimationFrame(() => { isDragging.current = false }))
  }

  // Path line points relative to group origin (no offset — group handles position)
  const segs = (path.pathProps.segments as number) ?? 64
  const positions = useMemo(() => {
    // Compute points in local space (no offset, no rotation) — group handles both
    const zeroPath = {
      ...path,
      position: [0, 0, 0] as [number, number, number],
      pathProps: { ...path.pathProps, rotationX: 0, rotationY: 0, rotationZ: 0 },
    }
    const arr = new Float32Array((segs + 1) * 3)
    for (let i = 0; i <= segs; i++) {
      const [x, y, z] = evaluatePathPosition(zeroPath, i / segs)
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z
    }
    return arr
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path.pathType, path.pathProps.length, path.pathProps.radius, path.pathProps.sweepAngle,
      path.pathProps.lineAxis, path.pathProps.segments,
      path.pathProps.rotationX, path.pathProps.rotationY, path.pathProps.rotationZ])

  const lineColor = isSelected ? '#ff8800' : '#7C3AED'

  return (
    <>
      <group ref={groupRef} position={path.position}>
        {/* Clickable origin marker */}
        <mesh
          renderOrder={999}
          onClick={(e) => { e.stopPropagation(); setSelectedNode(isSelected ? null : path.id) }}
        >
          <octahedronGeometry args={[0.12, 0]} />
          <meshBasicMaterial color={lineColor} wireframe depthTest={false} />
        </mesh>
        {/* Path line */}
        <line>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={lineColor} />
        </line>
      </group>
      {isSelected && (
        <TransformControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          object={groupRef as any}
          mode={gizmoMode === 'scale' ? 'translate' : gizmoMode}
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
        />
      )}
    </>
  )
}

export function SceneRenderer({
  editorShading = false,
  isEditorView = false,
}: {
  editorShading?: boolean
  isEditorView?: boolean
}) {
  const scene = useSceneStore((s) => s.scene)

  return (
    <>
      <EnvironmentLoader />
      {scene.backgroundShader && !isEditorView && (
        <BackgroundShader key={scene.backgroundShader.materialNodeId} bg={scene.backgroundShader} />
      )}
      {isEditorView && scene.paths.map((p) => (
        <PathObject key={p.id} path={p} />
      ))}
      {scene.lights.map((light) => (
        <LightObject key={light.id} light={light} isEditorView={isEditorView} meshes={scene.meshes} />
      ))}
      {scene.meshes.map((mesh) => (
        <MeshObject key={mesh.id} mesh={mesh} editorShading={editorShading} isEditorView={isEditorView} />
      ))}
      {scene.gltfObjects.map((gltf) => (
        <GltfObject key={gltf.id} gltf={gltf} editorShading={editorShading} isEditorView={isEditorView} smoothShading={scene.smoothShading} />
      ))}
      {isEditorView && scene.camera && (
        <CameraIcon camera={scene.camera} />
      )}
    </>
  )
}

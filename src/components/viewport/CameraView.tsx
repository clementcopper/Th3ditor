import { useFrame, useThree, Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { useRef, useEffect } from 'react'
import { SceneRenderer } from './SceneRenderer'
import { useSceneStore } from '../../store/scene-store'
import { evaluatePathPosition, evaluatePathTangent } from '../../graph-engine/path-utils'

const DEG2RAD = Math.PI / 180

/**
 * Raw THREE.PerspectiveCamera — no drei, no React props, zero reconciler interference.
 * ALL camera state (position, quaternion, fov) is set imperatively in a single useFrame.
 */
function RawCamera({ debugRef }: { debugRef: React.RefObject<HTMLPreElement | null> }) {
  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)
  const camRef = useRef<THREE.PerspectiveCamera | null>(null)

  // Scratch objects — pre-allocated, reused every frame
  const _qPathRot = useRef(new THREE.Quaternion()).current
  const _qFinal = useRef(new THREE.Quaternion()).current
  const _euler = useRef(new THREE.Euler()).current
  const _mat4 = useRef(new THREE.Matrix4()).current
  const _dir = useRef(new THREE.Vector3()).current
  const _up = useRef(new THREE.Vector3()).current

  // Create camera once and register as default
  useEffect(() => {
    const cam = new THREE.PerspectiveCamera(45, size.width / size.height, 0.1, 1000)
    camRef.current = cam
    set({ camera: cam })
    return () => { cam.dispose?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update aspect on resize
  useEffect(() => {
    if (camRef.current) {
      camRef.current.aspect = size.width / size.height
      camRef.current.updateProjectionMatrix()
    }
  }, [size])

  // DEBUG refs
  const frameRef = useRef(0)
  const prevQw = useRef(0)

  useFrame(() => {
    const cam = camRef.current
    if (!cam) return

    const scene = useSceneStore.getState().scene
    const camData = scene.camera
    if (!camData) return

    // --- FOV ---
    if (cam.fov !== camData.fov) {
      cam.fov = camData.fov
      cam.updateProjectionMatrix()
    }

    const isTarget = camData.mode === 1 && !!camData.targetNodeId
    const hasPath = !!camData.pathNodeId
    // Look-ahead only applies in Free mode (0) — Target mode uses lookAt to target
    const hasLookAhead = hasPath && !!camData.pathLookAhead && camData.mode === 0

    // --- Position ---
    if (hasPath) {
      const path = scene.paths.find((p) => p.id === camData.pathNodeId)
      if (path) {
        const t = camData.pathProgress ?? 0
        const pos = evaluatePathPosition(path, t)
        cam.position.set(pos[0], pos[1], pos[2])

        // --- Orientation for path + lookAhead ---
        if (hasLookAhead) {
          const tangent = evaluatePathTangent(path, t)
          _dir.set(tangent[0], tangent[1], tangent[2])

          if (path.pathType === 'line') {
            const lineAxis = (path.pathProps?.lineAxis as number) ?? 0
            _up.set(lineAxis === 1 ? 0 : 0, lineAxis === 1 ? 0 : 1, lineAxis === 1 ? 1 : 0)
          } else {
            // Circle/Arc: up = plane normal (XZ normal = Y-up, rotated with path)
            _up.set(0, 1, 0)
          }

          const rx = ((path.pathProps?.rotationX as number) ?? 0) * DEG2RAD
          const ry = ((path.pathProps?.rotationY as number) ?? 0) * DEG2RAD
          const rz = ((path.pathProps?.rotationZ as number) ?? 0) * DEG2RAD
          if (rx !== 0 || ry !== 0 || rz !== 0) {
            _qPathRot.setFromEuler(_euler.set(rx, ry, rz, 'XYZ'))
            _up.applyQuaternion(_qPathRot)
          }

          _mat4.lookAt(new THREE.Vector3(), _dir, _up)
          _qFinal.setFromRotationMatrix(_mat4)

          // Quaternion sign continuity: pick hemisphere closest to previous frame
          // avoids sudden 180° flips from setFromRotationMatrix sign ambiguity
          if (_qFinal.dot(cam.quaternion) < 0) {
            _qFinal.set(-_qFinal.x, -_qFinal.y, -_qFinal.z, -_qFinal.w)
          }

          cam.quaternion.copy(_qFinal)
        }
      }
    } else {
      // No path — use stored position
      cam.position.set(camData.position[0], camData.position[1], camData.position[2])
    }

    // --- Orientation: target mode ---
    if (isTarget && !hasLookAhead) {
      const target = scene.meshes.find((m) => m.id === camData.targetNodeId)
      if (target) {
        const [tx, ty, tz] = target.transform.position
        cam.lookAt(tx, ty, tz)
      }
    } else if (!hasLookAhead) {
      // Free mode — use stored euler rotation
      cam.rotation.set(
        camData.rotation[0] * DEG2RAD,
        camData.rotation[1] * DEG2RAD,
        camData.rotation[2] * DEG2RAD,
      )
    }

    // --- DEBUG HUD ---
    frameRef.current++
    if (frameRef.current % 6 === 0 && debugRef.current) {
      const t = camData.pathProgress ?? 0
      const qw = cam.quaternion.w
      const dqw = qw - prevQw.current
      prevQw.current = qw
      let dbg =
        `t: ${t.toFixed(3)}\n` +
        `pos: ${cam.position.x.toFixed(2)}, ${cam.position.y.toFixed(2)}, ${cam.position.z.toFixed(2)}\n` +
        `quat: ${cam.quaternion.x.toFixed(3)}, ${cam.quaternion.y.toFixed(3)}, ${cam.quaternion.z.toFixed(3)}, ${cam.quaternion.w.toFixed(3)}\n` +
        `Δqw: ${dqw.toFixed(4)}`
      if (hasPath && hasLookAhead) {
        const path = scene.paths.find((p) => p.id === camData.pathNodeId)
        if (path) {
          const tan = evaluatePathTangent(path, t)
          dbg += `\ntan: ${tan[0].toFixed(3)}, ${tan[1].toFixed(3)}, ${tan[2].toFixed(3)}`
          dbg += `\nup: ${_up.x.toFixed(3)}, ${_up.y.toFixed(3)}, ${_up.z.toFixed(3)}`
        }
      }
      debugRef.current.textContent = dbg
    }
  })

  return null
}

function CameraViewContents({ debugRef }: { debugRef: React.RefObject<HTMLPreElement | null> }) {
  return (
    <>
      <RawCamera debugRef={debugRef} />
      <SceneRenderer />
    </>
  )
}

export function CameraView() {
  const hasCamera = useSceneStore((s) => !!s.scene.camera)
  const debugRef = useRef<HTMLPreElement>(null)

  return (
    <div className="w-full h-full relative" style={{ background: 'oklch(0.16 0.008 48)' }}>
      {!hasCamera && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="text-xs text-text-muted">No Camera Node</span>
        </div>
      )}
      {/* DEBUG overlay — remove after debugging */}
      <pre
        ref={debugRef}
        className="absolute top-2 right-2 z-50 pointer-events-none"
        style={{
          background: 'rgba(0,0,0,0.85)', color: '#0f0', padding: '6px 10px',
          fontSize: 11, fontFamily: 'monospace', lineHeight: 1.4, whiteSpace: 'pre',
        }}
      />
      <Canvas>
        <color attach="background" args={['#191614']} />
        <CameraViewContents debugRef={debugRef} />
      </Canvas>
    </div>
  )
}

# LEARNINGS.md

Project-specific learnings. One line per entry, under 15 words, no explanations.
Add a bullet when something fails repeatedly, when Daniel has to re-explain, or when a
workaround for a platform/tool limitation is found. Only things that save future time.

General learnings about Daniel and process go into the global `~/.claude/CLAUDE.md` instead.

## Process & Environment

- Phase 4: Daniel reviews each step individually before starting the next.
- Brave browser: pointer-event hitbox issues with toolbar buttons. Works in Safari. Browser bug, not code.

## Store, Compiler & Undo

- `CompiledScene` passed to `setScene` must include `camera` or CameraView loses its camera on play.
- After `updateNodeData`, wait 2 RAF frames before clearing `isDragging` (compiler runs in useEffect).
- Compiler recompile on graph node drag: use `useGraphStore.subscribe` with custom equality, not hook deps.
- Undo/Redo toolbar buttons: use `useGraphStore.subscribe` + `useState` — selector hooks don't re-render reliably.
- Toolbar buttons: use `getState().undo()` / `getState().redo()` in onClick — same as keyboard shortcut.
- `snapshot()` in properties: use `() => useGraphStore.getState().snapshot()`, not hook selector (stale ref).
- SelectControl stores values as strings ('0','1','2') — use `Number(props.X ?? 0)`, never `(props.X as number)`.
- Color node defaults must be RGBA arrays `[r,g,b,a]` (0–1), never hex — compiler converts via `rgbaToHex6`.

## Graph & Nodes (ReactFlow)

- Gizmo write-back: use `getState()` inside event handlers, not hook subscriptions (stale closure).
- `noderef` PropertyType: filter by `getNodeDef(n.type)?.category`, NOT `n.data.category`.
- Node custom names: stored in `node.data.label`; `getNodeDisplayName()` in SceneExplorer.tsx.
- `useNodesInitialized` (xyflow) fires after node measurement — use for reliable fitView on init.
- `useReactFlow()` must be inside `<ReactFlow>` tree — crashes with "zustand provider" error otherwise.
- ReactFlow `panOnDrag={[0]}` + `onPaneMouseDown` unreliable for right-click; use container `onMouseDown`.
- Alt+drag duplicate: `useGraphStore.getState().setNodes(...)` in `onNodeDragStop` — atomic snap-back + new node.
- `portConnected`/`uniformFalsy` in VisibleWhenCondition — use for conditional port/property display.
- ReactFlow `visibleWhen` ports: handle only registers when rendered — set mode first, then connect cable.
- `NodeDefinition.hidden = true` hides node from palette (filtered in NodePalette.tsx).
- NodeRenderer fallback label: no `mode` select prop → first select prop appends ("Shader Math: Fract").
- Node port value display: `w-10 tabular-nums` fixed width prevents node width jumping during animation.
- Path constraints: connect via port cables, not noderef — compiler detects `edges.find(e => e.targetHandle === 'path')`.
- Path position/rotation via Transform chain — Path node has NO ports/props for position. See PATTERNS.md.
- `linkedPath: true` on PropertyDef → shows live evaluator value when `path` input port connected.
- `linkedPath: true` shows real world position (`evaluatePathPosition` result), NOT the Transform offset.
- Scale on Transform hidden when path port connected (`visibleWhenPortDisconnected: 'path'` on option).

## Viewport, Camera & Gizmos

- `SceneRenderer` takes `editorShading` prop — only the editor viewport passes it, CameraView does not.
- TransformControls + OrbitControls: `makeDefault` on OrbitControls → disable via `useThree().controls.enabled`.
- Mesh gizmo without Transform node: auto-create and wire into graph chain on first drag.
- Path gizmo drag without downstream edge: fallback silently (no Transform auto-create). Connect path first.
- Camera/Light gizmo snap-back: also write to scene store directly on drag end, not just graph store.
- `renderOrder={999}` + `depthTest={false}` required for viewport icons to appear in front of meshes.
- Three.js `<color>` doesn't parse `oklch()` — use hex values for R3F Canvas backgrounds.
- Two separate R3F Canvas instances (not drei `<View>`) work cleanly with react-resizable-panels.
- CSS 3D ViewCube: sync via `useFrame` + OrbitControls `getPolarAngle`/`getAzimuthalAngle`; mutate DOM directly.
- CSS 3D cube face label bug: check labels first before changing transforms or rotation-sync sign.
- Persp↔Ortho camera preservation: watch `useThree(s => s.camera)` object reference change in `useEffect`.
- OrbitControls: disable damping in ortho (`enableDamping={projectionMode==='perspective'}`) — prevents drift.
- OrbitControls top/bottom: custom `camera.up` swaps orbit axes — use `up:[0,1,0]` + `[eps,±dist,0]` epsilon.
- Editor viewport lights: fixed ambient + directional (no scene lights) — CameraView uses scene lights.
- Wireframe mode: use `meshBasicMaterial` (no lighting), not `meshStandardMaterial + wireframe=true`.
- Origin indicator: `THREE.LineSegments` + `transparent:true` to render above drei `Grid` (queue order).
- Camera icon cone tip at group origin: `rotation=[PI/2,0,0]`, `position=[0,0,-height/2]`, `thetaStart=PI/4`.
- CameraView uses raw THREE.PerspectiveCamera (no drei) — all state set imperatively in useFrame.
- R3F PerspectiveCamera `rotation` prop overrides quaternion from useFrame — new array ref re-applies every render.
- Three.js `cam.quaternion._onChangeCallback` corrupts multi-step quaternion ops — use scratch quaternion + copy.
- Camera Look-Ahead bounces on rotated circles: 10+ attempts failed — see THR3DITOR-PLAN.md Phase 5a. Deferred.
- Look-ahead only in Free mode (mode=0) — Target mode always uses lookAt to target mesh.
- Live evaluator must NOT compute euler for pathLookAhead — only CameraPathLookAhead handles orientation.
- Circle path: DO NOT clamp pathProgress — `evaluatePathPosition` wraps via `((t % 1) + 1) % 1`.
- Circle path `t=0` starts at +Z axis (π/2 offset in `evaluatePathPosition`).

## Lights & Environment

- Light nodes: unified `positionX/Y/Z` for both Directional and Point — `ptPositionX/Y/Z` removed.
- `RectAreaLight` needs `RectAreaLightUniformsLib.init()` once at module level; no shadow support.
- Area Light editor visual: custom LineSegments + Line (RectAreaLightHelper has unwanted BackSide mesh).
- HDR IBL: `RGBELoader` + `PMREMGenerator.fromEquirectangular()` → `scene.environment`; `environmentIntensity` (r163+).
- `EnvironmentLoader` background: use `showEnvBgRef` (ref, not closure) to avoid stale value in cleanup.

## Geometry

- Geometry node: one `Segments` slider per type; secondary segs auto-computed in `normalizeGeoProps`.
- Quad Sphere: BoxGeometry → toNonIndexed() → inflate → lat/lon UV + seam fix. No mergeVertices (breaks UVs).
- IcosahedronGeometry `detail` is linear: triangles = 20×(detail+1)². detail=80 ≈ 256-seg sphere. Max 256.
- Sphere pole UV fix (pole vertex u = avg neighbors) creates holes — non-indexed geometry displaces per triangle.
- Quad-Cylinder caps need CCW winding: top `(center, ring[i+1], ring[i])`, bottom `(center, ring[i], ring[i+1])`.
- Quad-Capsule: `L = length/radius`, `totalYSegs = 2*capSegs + round(capSegs*L)`; transforms equal at y=±L/2.
- `createQuadTorus`: ring in XY-plane (Z-axis), `toNonIndexed()` + longitude and latitude seam fix.
- Vertex displacement needs geo density ≥ noise feature size ×5. Silhouette jaggies are a WebGL limit.

## glTF

- `FileControl`: `param.accept?.includes('gltf')` controls folder button visibility.
- glTF bbox centering: compute raw bbox BEFORE `groupRef.current.add(scene)` — parent matrices skew it otherwise.
- `computeVertexNormals()` destroys UV seams on glTF — only toggle `flatShading = false/true` + `needsUpdate`.
- glTF texture UV fix: store `flipY: false` in node data → compiler → SceneRenderer. Don't pre-flip canvas.
- `geometry/gltf-mesh` index: `gltf-expand.ts` and `loadGltfGeometries` both traverse depth-first — indices match.
- gltfGeometryCache: module-level Map with in-flight Promise dedup via `gltfGeometryLoading` Map.
- MeshObject clones BufferGeometry from cache (nodes stay independent); disposes clone on cleanup.
- glTF Expand: store `matrixWorld` (16 floats) in gltf-mesh node data → `geo.applyMatrix4()` on clone.
- glTF Expand transparency: `MeshPhysicalMaterial.transmission > 0` → `transparent: true, opacity: 1 - transmission`.
- Multi-file glTF Expand: `extraFiles` through node data → compiler → geometrySource → loadGltfGeometries manager.

## Shader Graph & GLSL

- `customProgramCacheKey` must include `vertexPreamble` + `vertexBodyForPBR` — body alone reuses stale shaders.
- PBR displacement normals: 3-axis gradient sampling + project to tangential plane → `normalize(N - gradTan * scale)`.
- DO NOT use tangent-frame cross product for displacement normals — ring at `abs(N.y)=0.999`, pinch at poles.
- Silhouette fade (`smoothstep(0,0.8,|N·V|)`) creates circles at poles. Removed — accept minor jaggies.
- `shader/position` node → `vPosition` varying (object-space) — seamless 3D displacement without UV seams.
- `shader/colorramp` stops: positions + colors as uniforms → live update; recompile only on stop-count change.
- Domain warp IQ offsets: `(0,0,0)`, `(5.2,1.3,2.8)`, `(3.7,9.2,8.1)` for x/y/z fbm samples.
- Scan-line center: `radius − fract(t) × (radius×2)`. Use Multiply(−radius×2) + Add(radius) — Add is commutative.
- `shader/math` Lerp (op=7) needs T input port; Fract (op=8) is unary — else branch of binary/unary split.
- Displacement fold-bevel: deviation-based (`abs(center−avg6)`) hits ridge tips; gradient-based FAILS (0 at max).
- Bevel neighbour sampling: eps=0.15 in noise-space (post-scale), 6 samples (±x±y±z), 1-octave FBM.
- GLSL `if (uniform > threshold)` in vertex shader: zero-cost branch when uniform=0 — all warps same path.
- Shader Pattern aspect fix: `scaleY = scale / uAspect` → square cells; `scale` = columns, rows auto-adjust.
- Triplanar for seamless sphere dots: sample XY/XZ/YZ, blend by `abs(normalize(pos))`; `vPosition` fallback.
- `timeSpeed` default 0 → no animation on existing nodes; `uTime * timeSpeed` fallback when time port free.
- Noise CanvasTexture: `wrapS = wrapT = RepeatWrapping` + tile at integer scale to eliminate UV seams.
- Texture Normal mode: input port named `source` (not `texture`) — avoids collision with output port name.
- Texture Normal `source` port: always visible + auto-switch to mode=2 in onConnect.

## Properties Panel & CSS

- Font sizes: always Tailwind utility classes (`text-xs`, `text-[10px]`) — no inline `fontSize` px values.
- Conditional Tailwind classes break hover if the color class is missing in the false branch.
- Use inline `style` for opacity, static className for hover; never inline `style` for active/inactive color.
- Viewport toggles (Shaded/Wireframe, Persp/Ortho): conditional className for active state, or `hover:` won't fire.
- SliderControl `onBeforeChange`: fires on pointerdown, commitEdit (typed), first wheel tick (500ms idle reset).
- ColorControl `onBeforeChange`: fires on swatch open or first picker interaction (inline, 500ms idle reset).
- `SliderControl`: drag-bar (`flex-1`) + text input (`w-12`) in one row — drag-only, no click-to-edit toggle.
- `ColorControl`: R/G/B/A are inline `ChannelSlider` sub-components; HEX `w-[66px]`; dropdown `left-0 right-0`.
- `react-colorful` pointer CSS overrides must go in `index.css` — Tailwind arbitrary variants don't apply.

## Panels & Layout

- `react-resizable-panels` exports: `Group`, `Panel`, `Separator` — not PanelGroup/PanelResizeHandle/direction.
- ResizeHandle orientation arg must match PanelGroup orientation — swapping causes invisible handles.
- Panel collapse buttons (`BorderCollapseBtn`) live inside the panel at the border edge, NOT in the Separator.
- `PlaybackOverlay` `stacked`: full-width above controls when viewport < 820px; `ResizeObserver` detects it.
- `border-radius: 0 !important` on `*` overrides inline styles — use a named class with `!important` instead.
- CSS radius exceptions defined via `--radius-panel-btn` in the `@theme` block (`index.css`).

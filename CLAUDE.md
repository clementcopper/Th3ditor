## Kontext-Dokumente
- `Project Details/WVS-PLAN.md` — Architektur, Layout, UI Style, Node-Roadmap, Phasen-Plan. Immer aktuell halten.
- `Project Details/PATTERNS.md` — UI/UX Interaktionsmuster (Gizmo, Live-Anzeige, Port-Verbindung). Vor neuen Features lesen.
- `Project Details/` — weitere Planungs- und Referenz-Dokumente zum Projekt
- `Sessions/` — Session-Summaries (YYYY-MM-DD.md), erstellt durch `/pre-compact`. Nur die **neueste** Datei lesen — ältere sind bereits in WVS-PLAN.md/CLAUDE.md eingeflossen.

## Workflow Notes
- Use `pnpm`, not `npm`
- Keep responses concise — fix first, explain briefly
- Dev server: `pnpm dev` / Build: `pnpm build`
- Daniel communicates in German, tests live in browser, reports visual bugs
- **All UI text in the app must be English** — labels, options, button text, placeholders, everything
- Daniel works on two computers — keep `CLAUDE.md` and `WVS-PLAN.md` updated as the cross-machine context sync
- Keep CLAUDE.md <200 lines
- Don't make changes until 95% confident. Ask follow-up questions until that confidence is reached.

## Applied Learning
When something fails repeatedly, when Daniel has to re-explain, or when a workaround is found for a platform/tool limitation, add a one-line bullet here. Keep each bullet under 15 words. No explanations. Only add things that will save time in future sessions.

- `react-resizable-panels` exports: `Group`, `Panel`, `Separator` — not PanelGroup/PanelResizeHandle/direction.
- Phase 4: Daniel reviews each step individually before starting the next.
- ResizeHandle orientation arg must match PanelGroup orientation — swapping causes invisible handles.
- LiveEvaluator `setScene` must include `camera` field or CameraView loses its camera on play.
- Two separate R3F Canvas instances (not drei `<View>`) work cleanly with react-resizable-panels.
- `SceneRenderer` takes `editorShading` prop — only EditorView passes it, CameraView does not.
- Gizmo write-back: use `getState()` inside event handlers, not hook subscriptions (stale closure).
- TransformControls + OrbitControls: `makeDefault` on OrbitControls → disable via `useThree().controls.enabled`.
- After `updateNodeData`, wait 2 RAF frames before clearing `isDragging` (compiler runs in useEffect).
- Mesh gizmo without Transform-Node: auto-create and wire into graph chain on first drag.
- Light nodes: unified `positionX/Y/Z` for both Directional and Point — `ptPositionX/Y/Z` removed.
- Camera/Light gizmo snap-back: also write to scene store directly on drag end, not just graph store.
- `noderef` PropertyType: filter by `getNodeDef(n.type)?.category`, NOT `n.data.category`.
- Node custom names: stored in `node.data.label`; `getNodeDisplayName()` in SceneExplorer.tsx.
- `renderOrder={999}` + `depthTest={false}` required for viewport icons to appear in front of meshes.
- Three.js `<color>` doesn't parse `oklch()` — use hex values for R3F Canvas backgrounds.
- `useNodesInitialized` (xyflow) fires after node measurement — use for reliable fitView on init.
- `useReactFlow()` must be inside `<ReactFlow>` tree — crashes with "zustand provider" error otherwise.
- ReactFlow `panOnDrag={[0]}` + `onPaneMouseDown` unreliable for right-click; use container `onMouseDown` instead.
- CSS 3D ViewCube: sync rotation via `useFrame` + OrbitControls `getPolarAngle`/`getAzimuthalAngle`; mutate DOM directly.
- Persp↔Ortho camera preservation: watch `useThree(s => s.camera)` object reference change in `useEffect`.
- Alt+drag duplicate: use `useGraphStore.getState().setNodes(...)` in `onNodeDragStop` for atomic snap-back + new node.
- CSS 3D cube face label bug: check labels first before changing transforms or rotation-sync sign.
- Font sizes: always use Tailwind utility classes (`text-xs`, `text-[10px]`) — avoid inline `fontSize` px values.
- Path constraints: connect via port cables (not noderef dropdown) — compiler detects via `edges.find(e => e.targetHandle === 'path')`.
- Circle path: DO NOT clamp pathProgress — `evaluatePathPosition` handles wrap via `((t % 1) + 1) % 1`.
- EditorView viewport lights: fixed ambient + directional (no scene lights) — CameraView uses scene lights.
- Wireframe mode: use `meshBasicMaterial` (no lighting) not `meshStandardMaterial + wireframe=true`.
- Camera Look-Ahead bounce on rotated circles: 10+ attempts failed — see WVS-PLAN.md Phase 5a. Deferred.
- R3F PerspectiveCamera `rotation` prop overrides quaternion set by useFrame — new array ref triggers re-apply every render.
- LiveEvaluator must NOT compute euler for pathLookAhead — only CameraPathLookAhead handles orientation.
- CameraView uses raw THREE.PerspectiveCamera (no drei) — all state set imperatively in useFrame.
- Look-ahead only in Free mode (mode=0) — Target mode always uses lookAt to target mesh.
- Three.js cam.quaternion._onChangeCallback corrupts multi-step quaternion ops — use scratch quaternion + copy.
- Path position/rotation via Transform chain — Path node has NO ports/props for position. See PATTERNS.md.
- `linkedPath: true` on PropertyDef → shows live evaluator value when `path` input port connected.
- Path gizmo drag without downstream edge: fallback silently (no Transform auto-create). Connect path first.
- `linkedPath: true` shows real world position (evaluatePathPosition result), NOT the Transform offset.
- `portConnected`/`uniformFalsy` added to VisibleWhenCondition — use for conditional port/property display.
- Compiler recompile on graph node drag: use `useGraphStore.subscribe` with custom equality, not hook deps.
- Scale on Transform hidden when path port connected (`visibleWhenPortDisconnected: 'path'` on option).
- glTF bbox centering: compute raw bbox BEFORE `groupRef.current.add(scene)` — world matrices include parent transform otherwise.
- All UI text in the app must be in English (labels, options, buttons, placeholders).
- `computeVertexNormals()` destroys UV seams on glTF — only toggle `flatShading = false/true` + `needsUpdate`.
- OrbitControls top/bottom: custom `camera.up` swaps orbit axes — use `up:[0,1,0]` + `[eps,±dist,0]` epsilon.
- HDR IBL: `RGBELoader` + `PMREMGenerator.fromEquirectangular()` → `scene.environment`; `scene.environmentIntensity` (r163+).
- Color node defaults must be RGBA arrays `[r,g,b,a]` (0–1), never hex strings — compiler converts via `rgbaToHex6`.
- `FileControl`: `param.accept?.includes('gltf')` controls folder button visibility.
- `RectAreaLight` needs `RectAreaLightUniformsLib.init()` once at module level; no shadow support.
- Area Light editor visual: custom LineSegments + Line (no RectAreaLightHelper — has unwanted BackSide mesh).
- `EnvironmentLoader` background: use `showEnvBgRef` (ref, not closure) to avoid stale value in cleanup.
- Circle path `t=0` starts at +Z axis (π/2 offset in `evaluatePathPosition`).
- Node port value display: `w-10 tabular-nums` fixed width prevents node width jumping during animation.
- Noise CanvasTexture: set `wrapS = wrapT = RepeatWrapping` + tile at integer scale to eliminate UV seams.
- ReactFlow `visibleWhen` ports: handle only registers when rendered — set mode first, then connect cable.
- Texture Normal mode: input port named `source` (not `texture`) to avoid same-name collision with output port.
- glTF texture UV fix: store `flipY: false` in node data, propagate through compiler, apply in SceneRenderer — don't pre-flip canvas.
- `geometry/gltf-mesh` index: `gltf-expand.ts` and `loadGltfGeometries` both use `scene.traverse()` depth-first — indices match.
- gltfGeometryCache: module-level Map (not component state) with in-flight Promise dedup via `gltfGeometryLoading` Map.
- MeshObject clones BufferGeometry from cache (so multiple nodes sharing same file are independent); disposes clone on cleanup.
- Quad Sphere: BoxGeometry → toNonIndexed() → inflate → lat/lon UV + seam fix. No mergeVertices (breaks UVs). Normals = normalize(pos).
- IcosahedronGeometry `detail` = linear grid subdivision: triangles = 20×(detail+1)². NOT exponential. detail=80 ≈ 256-seg sphere. Max 256 (500 laggy).
- Sphere pole UV fix attempt (set pole vertex u = avg neighbors) creates holes — non-indexed geometry displaces pole differently per triangle.
- Texture Normal `source` port: always visible + auto-switch to mode=2 in onConnect — user doesn't need to set mode first.
- `NodeDefinition.hidden = true` hides node from palette (filter in NodePalette.tsx `getAllNodeDefs().filter(d => !d.hidden)`).
- glTF Expand: store `matrixWorld` (16-element array) in gltf-mesh node data → apply `geo.applyMatrix4()` on clone in SceneRenderer.
- glTF Expand transparency: `MeshPhysicalMaterial.transmission > 0` → `transparent: true, opacity: 1 - transmission`.
- Multi-file glTF Expand: pass `extraFiles` through node data → compiler → geometrySource → loadGltfGeometries LoadingManager.
- SelectControl stores values as strings ('0','1','2') — always use `Number(props.X ?? 0)` not `(props.X as number) ?? 0` for select properties.
- Three.js `customProgramCacheKey` must include `vertexPreamble` + `vertexBodyForPBR` — key on body alone causes stale shader reuse when only preamble changes (e.g. noise type switch).
- PBR displacement: finite-diff normals eps=0.1, gradient clamp ±1.5 — lower eps causes extreme normals at sharp noise (Voronoi) boundaries.
- Shader graph `shader/position` node → `vPosition` varying (object-space) — use for seamless 3D displacement without UV seams.
- Vertex displacement needs geo density ≥ noise feature size ×5 — 256 sphere segs is practical max (512 laggy); icosphere detail 200 equivalent.
- `shader/colorramp` stops: all positions + colors as uniforms → live update without recompile; recompile only on stop-count change.
- NodeRenderer fallback label: if no `mode` select prop, first select prop appends to label ("Shader Math: Fract").
- Domain warp IQ offsets: `(0,0,0)`, `(5.2,1.3,2.8)`, `(3.7,9.2,8.1)` for x/y/z fbm samples.
- Scan-line center: `radius − fract(t) × (radius×2)` top→bottom. Use Multiply(−radius×2) + Add(radius) — Add is commutative, avoids A/B confusion.
- `shader/math` Lerp (op=7) needs T input port; Fract (op=8) is unary — goes in the `else` branch of the binary/unary split.
- Undo/Redo toolbar buttons: use `useGraphStore.subscribe` + `useState` for reactivity — selector hooks don't reliably trigger re-renders here.
- Toolbar buttons: use `getState().undo()` / `getState().redo()` in onClick — same pattern as keyboard shortcut.
- Conditional Tailwind classes on buttons break hover if color class missing in false-branch — use inline `style` for opacity, static className for hover.
- Brave browser: pointer-event hitbox issues with toolbar buttons. Works in Safari. Browser-specific bug, not code issue.
- `snapshot()` in properties: use `() => useGraphStore.getState().snapshot()` not hook selector — avoids stale reference.
- SliderControl `onBeforeChange`: fires on pointerdown (drag), commitEdit (typed), first wheel tick (500ms idle reset).
- ColorControl `onBeforeChange`: fires on swatch open (dropdown) or first picker interaction (inline, 500ms idle reset).

## Overview
Node-based 3D/2D visual editor (Web Visual Studio). Built by Daniel Martin (DMA) for Designdone.
Formerly "Shadertool" — rebuilt from fullscreen shader previewer to full node-based scene editor.

## Tech Stack
- React 19 + TypeScript + Vite + Zustand (state) + Tailwind CSS 4
- Three.js + React Three Fiber (R3F) + @react-three/drei — 3D rendering
- @xyflow/react (ReactFlow) — node-based visual programming graph
- react-resizable-panels — resizable panel layout (Phase 4)
- GLSL for custom shader materials

## Architecture

### Node-Based Editor
- Users build scenes by connecting nodes in a visual graph
- Node categories: Geometry, Material, Transform, Light, Camera, Shader, Math, Color, Texture, Time, Input, Effect, Scene
- Scene Output is the terminal node — the graph compiles into a Three.js scene

### Rendering Pipeline
```
[Graph Store] --mutation--> [Compiler (topo-sort)] --CompiledScene--> [SceneRenderer (R3F)]
                                                                            |
                                                                      [useFrame loop]
                                                                            |
                                                                      [Live Evaluator] (time, mouse)
```
- Structural changes (add/remove node/edge) → full recompile
- Per-frame updates (time, mouse) → only dynamic subgraph evaluation

### State Management (State Multi-Store)
- `graph-store.ts` — nodes, edges, CRUD operations
- `editor-store.ts` — UI state: selected node, view mode, shadingMode, projectionMode
- `scene-store.ts` — compiled scene (output of graph compiler)
- `animation-store.ts` — playing, elapsed, play/pause/reset
- `evaluator-store.ts` — live float values keyed by `"nodeId:portName"` (~10fps throttle)

### Project Structure
```
src/
  types/properties.ts              # PropertyDef (evolved from ParameterDef)
  types/node-graph.ts              # Node, Edge, Port, NodeDefinition
  store/                           # Zustand stores
  graph-engine/                    # Compiler, node registry, type system, live-evaluator
    node-definitions/              # Per-category node definitions
  components/
    editor/                        # EditorLayout, EditorHeader, EditorFooter
    viewport/                      # ViewportPanel, EditorView, CameraView, SceneRenderer,
                                   # SceneExplorer (overlay), Gizmos
    graph/                         # ReactFlow wrapper, NodeRenderer, NodePalette
    properties/                    # PropertiesPanel
      controls/                    # SliderControl, ColorControl, ToggleControl, SelectControl
  utils/color.ts                   # Color space conversions (RGB, HSL, OKLCH)
  utils/download.ts                # File download helpers
  shaders/chunks/                  # Archived GLSL snippets (noise, color, math)
```

### UI Style
- Dark warm theme: `oklch(45% 0.008 48)` base, orange accent `oklch(70% 0.18 48)`
- `border-radius: 0` everywhere
- OKLCH for design tokens; HEX/RGB/HSL primary in color picker (user-facing)

## Current Status (2026-04-15)
- Phase 1–5e complete ✅
- **⚠️ Deferred Bug:** Camera Look-Ahead bounces on rotated circle paths. 10+ fix attempts — see WVS-PLAN.md Phase 5a.
- **Visual Shader Graph complete ✅**: shader/color (Color/Mix/Ramp modes, value+alpha outputs), noise, math, domain warp, etc.; unlit + PBR displacement modes
- **Phase 6 partial ✅**: Save/Load (.wvs JSON), Undo/Redo (snapshot-based, Cmd+Z/Cmd+Shift+Z + toolbar buttons)
- Next: Phase 6 remaining (React/R3F export, standalone HTML export, post-processing)
- Fonts: Bunny Fonts (privacy-friendly Google Fonts mirror) — später lokal einbinden

## Planned: Quad-Mesh Primitives (Phase 6+)
- Three.js built-in geometries (Sphere, Cylinder, Capsule) have UV seams at poles and cap-rims that break displacement mapping
- Plan: Daniel provides Blender-authored quad meshes (.glb) per primitive → bundled as `src/assets/geometry/`
- Requirements for meshes: single UV island per mesh, no pole singularities, ≥32×32 quads for displacement, caps and sides share UV space
- Cylinder/Capsule seams currently not fixable via tiling — openEnded option deferred pending quad-mesh solution
- Sphere poles (SphereGeometry) not fixable via UV tiling — use Icosphere or quad-sphere

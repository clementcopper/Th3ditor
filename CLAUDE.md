## Zentrales Planungsdokument
`Project Details/WVS-PLAN.md` — Architektur, Layout, UI Style, Node-Roadmap, Phasen-Plan. Immer aktuell halten.

## Workflow Notes
- Use `pnpm`, not `npm`
- Keep responses concise — fix first, explain briefly
- Dev server: `pnpm dev` / Build: `pnpm build`
- Daniel communicates in German, tests live in browser, reports visual bugs
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
- Camera Look-Ahead XY/YZ bug: world-Y up, euler override, rotation-prop override all tried — see WVS-PLAN.md Phase 5a.
- R3F PerspectiveCamera `rotation` prop overrides quaternion set by useFrame — new array ref triggers re-apply every render.
- LiveEvaluator must NOT compute euler for pathLookAhead — only CameraPathLookAhead handles orientation.

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

## Current Status (2026-04-09)
- Phase 1 + 2 + 3 + 4 complete ✅
- Phase 5a complete ✅: Path Nodes (Line/Circle/Arc), Camera/Light path ports, Path gizmos, SceneExplorer paths, EditorView fixed lighting, Wireframe flat shading
- **⚠️ Open Bug:** Camera Look-Ahead bounces on XY/YZ circle paths (XZ works). 5 fix attempts failed — see WVS-PLAN.md Phase 5a for details.
- Geometry Nodes: Box, Sphere, Plane, Torus, Cylinder, Capsule, Icosphere (alle mit vollständigen Segment-Properties)
- Fonts: Bunny Fonts (privacy-friendly Google Fonts mirror) — später lokal einbinden
- Next: Phase 5b — glTF Import Node; danach Phase 5c — Custom GLSL Shader-Node

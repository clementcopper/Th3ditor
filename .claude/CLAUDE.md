# Web Visual Studio — Project Context

## Overview
Node-based 3D/2D visual editor for creating animated web visuals. Built by Daniel Martin (DMA) for Designdone.
Formerly "Shadertool" — renamed and rearchitected from a fullscreen shader previewer to a full scene editor.

## Tech Stack
- React 19 + TypeScript + Vite + Zustand (state) + Tailwind CSS 4
- Three.js + React Three Fiber (R3F) + @react-three/drei — 3D rendering
- @xyflow/react (ReactFlow) — node-based visual programming graph
- Theatre.js — `@theatre/core` (animation engine/runtime) + `@theatre/studio` (timeline UI, Phase 5A) + `@theatre/r3f` (R3F integration)
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

### State Management (Zustand Multi-Store)
- `graph-store.ts` — nodes, edges, CRUD operations
- `editor-store.ts` — UI state: selected node, view mode, sidebar
- `scene-store.ts` — compiled scene (output of graph compiler)
- Animation via Theatre.js (`@theatre/core` engine + `state.json` serialization)

### Project Structure
```
src/
  types/properties.ts              # PropertyDef (evolved from ParameterDef)
  types/node-graph.ts              # Node, Edge, Port, NodeDefinition
  store/                           # Zustand stores
  graph-engine/                    # Compiler, node registry, type system
    node-definitions/              # Per-category node definitions
  components/
    editor/                        # EditorLayout, Toolbar, ViewportTabs
    viewport/                      # R3F Canvas, SceneRenderer
    graph/                         # ReactFlow wrapper, NodeRenderer, NodePalette
    properties/                    # PropertiesPanel
      controls/                    # SliderControl, ColorControl, ToggleControl, SelectControl
  utils/color.ts                   # Color space conversions (RGB, HSL, OKLCH)
  utils/download.ts                # File download helpers
  shaders/chunks/                  # Archived GLSL snippets (noise, color, math)
```

### Reused from Shadertool
- UI Controls: SliderControl (Blender-style drag-to-scrub), ColorControl (RGBA + HEX/RGB/HSL/OKLCH), ToggleControl, SelectControl
- Controls import `PropertyDef` (aliased as `ParameterDef`) from `types/properties.ts`
- `utils/color.ts` — comprehensive color space library (RGB, HSL, Oklab, OKLCH)
- `utils/download.ts` — blob download helpers
- `index.css` — Tailwind theme with OKLCH design tokens, Fira Sans + Fira Code fonts
- GLSL utility shaders archived in `shaders/chunks/` (simplex noise, voronoi, OKLCH, math)

### UI Patterns (carried over)
- Blender-style drag-to-scrub input fields, 3px accent line
- Toggle buttons for dropdowns with ≤3 options
- Rotation parameters in degrees with ° suffix
- `visibleWhen` for conditional parameter visibility
- `suffix` field on PropertyDef for unit display

## Implementation Phases

### Phase 1: Foundation (DONE)
- [x] Cleanup, dependencies, types, stores, graph engine, first nodes, components
- [x] 4 connected nodes → blue box in viewport

### Phase 2: Properties Panel + More Nodes + Node Palette (DONE)
- [x] EditorLayout restructured: Toolbar top, Viewport top-left, Graph bottom-left, Properties right, StatusBar
- [x] PropertiesPanel with SliderControl, ColorControl, ToggleControl, SelectControl
- [x] NodePalette: categorized, searchable, click-to-add
- [x] Lights: Ambient, Directional, Point
- [x] Transforms: Translate, Rotate, Scale (with degree suffix)
- [x] Geometry: Cylinder added (Box, Sphere, Plane, Torus, Cylinder)
- [x] Port-type validation on connect (canConnect check)
- [x] Compiler supports transforms (position/rotation/scale chain) and lights

### Phase 3: Time, Math & Live Evaluation (DONE)

- [x] Time nodes: Time (elapsed + delta + speed), Sin(Time) (speed, amplitude, offset)
- [x] Math nodes: Add, Multiply, Sin, Cos, Lerp, Clamp, Remap
- [x] Input nodes: Mouse (x, y, normalized), Screen Size
- [x] Live-Evaluator: useFrame loop evaluates dynamic float subgraph per frame
- [x] Float ports: time/math/input outputs connect to material/transform/geometry float inputs
- [x] Animation store: play/pause/reset + elapsed time
- [x] Play/Pause + Reset + time display in EditorToolbar

### Phase 4: Custom Shaders + Textures ← CURRENT

### Phase 5A: Animation mit Theatre.js Studio (schnell funktional, UI-Konsistenz zweitrangig)
### Phase 5B: Eigenes Timeline-UI (Theatre.js Studio ersetzen, eigener Stil)
### Phase 6: Export + Post-Processing + Polish

## Workflow Notes
- Use `pnpm`, not `npm`
- Keep responses concise — fix first, explain briefly
- Dev server: `npm run dev` / Build: `npm run build`
- Daniel communicates in German, tests live in browser, reports visual bugs
- Daniel works on two computers — keep CLAUDE.md updated as the cross-machine context sync

## Current Status (2026-04-01)

- Phase 1 + Phase 2 + Phase 3 complete
- Layout: Toolbar (with Play/Pause/Reset), 3D Viewport (top-left), Node Graph (bottom-left), Properties Panel (right 280px), Status Bar
- Node types: Box, Sphere, Plane, Torus, Cylinder | Standard Material | Mesh | Ambient/Directional/Point Light | Translate/Rotate/Scale | Scene Output | Time, Sin(Time) | Add, Multiply, Sin, Cos, Lerp, Clamp, Remap | Mouse, Screen Size
- Live-Evaluator in useFrame: dynamic float subgraph (time/math/input) evaluated per frame, feeds into material/transform/geometry props
- Animation store: play/pause/reset with elapsed time counter
- TypeScript compiles clean, build succeeds
- Next: Phase 4 — Custom Shaders + Textures

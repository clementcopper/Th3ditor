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
- Point-light node uses `ptPositionX/Y/Z`; directional uses `positionX/Y/Z` — write-back must match.
- Three.js `<color>` doesn't parse `oklch()` — use hex values for R3F Canvas backgrounds.
- `useNodesInitialized` (xyflow) fires after node measurement — use for reliable fitView on init.

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

### State Management (Zustand Multi-Store)
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

## Current Status (2026-04-08)
- Phase 1 + 2 + 3 complete
- Phase 4 complete ✅: Layout, Dual Viewport, Camera-Node, Scene Explorer, Play/Pause, Shading/Perspektiv-Toggle, Gizmos, Viewport Helpers, Camera Rotation
- Fonts: Bunny Fonts (privacy-friendly Google Fonts mirror) — später lokal einbinden
- Next: Phase 5 — Custom GLSL Shader-Node + Texture-Nodes

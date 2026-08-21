# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context Documents
- `Project Details/THR3DITOR-PLAN.md` — architecture, layout, UI style, node roadmap, phase plan. Keep current.
- `Project Details/PATTERNS.md` — UI/UX interaction patterns (gizmo, live display, port connections). Read before new features.
- `Project Details/WVS-LAYOUT_2Layout.png`, `Project Details/rechtes panel zugeklappt.png` — layout reference screenshots.
- `LEARNINGS.md` — project-specific learnings, grouped by topic. Append a bullet when a fix was non-obvious.
- `Sessions/` — session summaries (YYYY-MM-DD.md) written by `/pre-compact`. Read only the **newest** file; older ones are already folded into THR3DITOR-PLAN.md/CLAUDE.md.

## Commands
```bash
pnpm dev      # Vite dev server
pnpm build    # tsc -b && vite build
pnpm lint     # ESLint 9 flat config (eslint.config.js)
pnpm preview  # serve dist/
```
No test framework is installed — there are no unit tests. Verification happens by running the app.

## Workflow Notes
- Use `pnpm`, not `npm`
- Keep responses concise — fix first, explain briefly
- Daniel communicates in German, tests live in the browser, reports visual bugs
- **All UI text in the app must be English** — labels, options, button text, placeholders, everything
- Daniel works on two computers — `CLAUDE.md` and `THR3DITOR-PLAN.md` are the cross-machine context sync
- Keep CLAUDE.md <200 lines; learnings go to `LEARNINGS.md`, not here
- Don't make changes until 95% confident. Ask follow-up questions until that confidence is reached.

## Overview
Node-based 3D/2D visual editor. Package name `thr3ditor`, repo folder `Thr3ditor`, project files use the `.3dtr` extension. Built by Daniel Martin (DMA) for Designdone. Formerly "Shadertool" — rebuilt from a fullscreen shader previewer into a full node-based scene editor.

## Tech Stack
- React 19 + TypeScript + Vite 8 + Zustand + Tailwind CSS 4
- Three.js 0.175 + React Three Fiber 9 + @react-three/drei — 3D rendering
- @xyflow/react (ReactFlow 12) — node graph
- react-resizable-panels 4 — panel layout
- GLSL for custom shader materials

## Architecture

### Rendering Pipeline
```
[graph-store] --structural change--> [compileGraph] --CompiledScene--> [scene-store] --> [SceneRenderer (R3F)]
                                                                                              |
                                                                                     [useFrame loop]
                                                                                              |
                                                                          [evaluator.ts] (time, mouse, paths)
```
- The compile trigger lives in `EditorLayout.tsx` (~line 165): a `useGraphStore.subscribe` with a manual structural diff (`edges` identity, node count, node `id`/`type`/`data` identity). **Node position changes deliberately do not recompile.**
- Per-frame updates run inside `SceneRenderer.tsx`'s `useFrame`, calling `evaluateFloatPort` / `evaluateColorPort` from `graph-engine/evaluator.ts`. There is no separate LiveEvaluator component.
- Live values are pushed to `evaluator-store` (throttled ~10fps) so the node graph and properties panel can display them.

### State (multi-store Zustand)
- `graph-store.ts` — nodes, edges, CRUD, undo/redo. History lives in module-level arrays outside the store (max 50) so snapshots don't re-render. Call `snapshot()` **before** a mutation.
- `editor-store.ts` — UI state: selected node, view mode, shadingMode, projectionMode, gizmoMode, snapView
- `scene-store.ts` — the `CompiledScene`
- `animation-store.ts` — playing, elapsed, play/pause/reset
- `evaluator-store.ts` — live float/color values keyed by `"nodeId:portName"`

### Node System
Every node type is a `NodeDefinition` (`types/node-graph.ts`): `inputs`/`outputs` (`PortDef`), `properties` (`PropertyDef` from `types/properties.ts`), and `defaults`. Nodes carry no logic — the compiler and renderer switch on `node.type`.

**Adding a node type:**
1. Define it in `graph-engine/node-definitions/<category>.ts` and register it in that file's `registerXNodes()`.
2. If the file is new, call its register function from `graph-engine/register-all.ts`. `registerAllNodes()` runs once in `App.tsx` before render.
3. Add the compile branch in `graph-engine/compiler.ts` (or `shader-graph-compiler.ts` for `shader/*` nodes).
4. Add the render branch in `components/viewport/SceneRenderer.tsx`.
5. Live-animatable float/color ports also need a branch in `graph-engine/evaluator.ts`.

Properties render generically in `PropertiesPanel.tsx` via `PropertyType` → control component. `visibleWhen` conditions (`uniform` equal/notEqual, `portConnected`, `portDisconnected`, `uniformFalsy`) drive conditional ports and properties.

### Two Shader Paths
- **Unlit**: `shader/output` → mesh directly. `shader-graph-compiler.ts` emits a complete vertex + fragment shader for a `ShaderMaterial`.
- **PBR**: `shader/output` → material → mesh. The same compiler emits injection fragments (`vertexPreamble`, `vertexBodyForPBR`, `fragmentPreamble`, `fragmentPBRBody`, `fragmentPBR`) that `SceneRenderer` splices into `MeshStandardMaterial` via `onBeforeCompile`.
The GLSL noise library is a template string at the top of `shader-graph-compiler.ts` (`NOISE_PREAMBLE`). There is no `src/shaders/` directory.

### Project Structure
```
src/
  App.tsx                          # registerAllNodes() + <EditorLayout/>
  types/node-graph.ts              # NodeDefinition, GraphNode/Edge, Compiled* scene types
  types/properties.ts              # PropertyDef, PropertyType, VisibleWhenCondition
  store/                           # 5 Zustand stores (see above)
  graph-engine/
    compiler.ts                    # graph -> CompiledScene (620 lines)
    shader-graph-compiler.ts       # shader/* subgraph -> GLSL (1300 lines)
    evaluator.ts                   # per-frame float/color port evaluation
    node-registry.ts               # register/getNodeDef/getAllNodeDefs
    register-all.ts                # calls every registerXNodes()
    path-utils.ts                  # evaluatePathPosition (line/circle/arc)
    gltf-expand.ts                 # glTF scene -> generated graph nodes
    node-definitions/              # 15 files, one per category
  components/
    editor/                        # EditorLayout (panels + compile trigger), EditorToolbar, StatusBar
    viewport/                      # SceneRenderer (2700 lines, the render switchboard),
                                   # Viewport3D (editor view), CameraView, SceneExplorer
    graph/                         # NodeEditor (ReactFlow), NodeRenderer, NodePalette, DataEdge
    properties/PropertiesPanel.tsx # + controls/ (Slider, Color, ColorRamp, Select, Toggle, File, TextArea)
    tool/controls/                 # SEPARATE, simplified control set — do not confuse with properties/controls
  utils/color.ts                   # RGB/HSL/OKLCH conversions
  utils/project.ts                 # save/load .3dtr JSON
  utils/download.ts, node-icons.tsx
```
`src/export/templates/` and `src/components/landing/` exist but are empty stubs for Phase 6.
Repo root also holds `3D Assets/` (test models) and `public/`.

### UI Style
- Dark warm theme: `oklch(45% 0.008 48)` base, orange accent `oklch(70% 0.18 48)`
- `border-radius: 0` everywhere — exceptions via `.panel-collapse-btn-h/v` + `--radius-panel-btn` in `index.css`
- OKLCH for design tokens; ColorControl is RGB-only (R/G/B 0–255 + HEX field + A%)
- Three.js cannot parse `oklch()` — use hex for anything passed into R3F

## Current Status (2026-08-21)
- Phase 1–5e complete ✅
- **⚠️ Deferred bug:** Camera Look-Ahead bounces on rotated circle paths. 10+ fix attempts — see `Project Details/THR3DITOR-PLAN.md` Phase 5a.
- **Visual Shader Graph complete ✅**: shader/color (Color/Mix/Ramp), noise, math, domain warp, pattern/dots/lines; unlit + PBR displacement modes
- **Phase 6 partial ✅**: Save/Load (`.3dtr` JSON, `utils/project.ts`), Undo/Redo (snapshot-based, Cmd+Z / Cmd+Shift+Z + toolbar)
- **UI polish ✅**: origin indicator, Quad Torus, one Segments slider per geometry type, ortho damping fix, split SliderControl, ColorControl channel sliders
- Next: Phase 6 remaining — React/R3F export, standalone HTML export, post-processing
- Fonts: Bunny Fonts (privacy-friendly Google Fonts mirror) — to be bundled locally later

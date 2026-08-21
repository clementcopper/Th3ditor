# Thr3ditor

**A node-based 3D scene editor that runs in the browser.** Build animated Three.js scenes visually — connect geometry, materials, lights, cameras, paths, and transforms in a graph and see the result render in real time.

> Built by DMA — Interface Design & Design Engineering.

---

## Features

- **Node Graph** — visual programming interface powered by ReactFlow; connect nodes to compose scenes
- **Dual Viewport** — Editor view (orbit controls, gizmos, grid) + Camera view (final render, no UI)
- **Properties Panel** — per-node controls: sliders, color pickers, toggles, selects
- **Gizmos** — translate/rotate/scale controls for meshes, lights, cameras and paths in the editor view
- **Path Constraints** — attach cameras and lights to Line, Circle, or Arc paths via Transform chains
- **Live Animation** — Time, Math and Input nodes drive per-frame updates via a dedicated live evaluator
- **Scene Explorer** — overlay listing all meshes, lights, cameras and paths with type icons
- **Resizable Layout** — all panel borders are draggable (viewport, graph, properties)
- **Dark Warm UI** — OKLCH-based design tokens, orange accent, zero border-radius

---

## Tech Stack

| Layer | Library |
|---|---|
| UI Framework | React 19 + TypeScript + Vite |
| 3D Rendering | Three.js + React Three Fiber + @react-three/drei |
| Node Editor | @xyflow/react (ReactFlow) |
| State | Zustand (multi-store) |
| Layout | react-resizable-panels |
| Styling | Tailwind CSS 4 + OKLCH design tokens |
| Shading | GLSL (custom shader materials) |

---

## Architecture

The graph compiles into a `CompiledScene` on every structural change. Per-frame updates (time, mouse, path positions) run through a separate live evaluator — no full recompile on every frame. Node position changes in the graph canvas are ignored by the compiler.

```
[Graph Store] → [Compiler] → [CompiledScene] → [SceneRenderer (R3F)]
                                                        ↓
                                                [useFrame loop]
                                                        ↓
                                                [Live Evaluator]
                                                (Time, Math, Paths)
```

### Node Categories

`Geometry` · `Material` · `Object/Mesh` · `Transform` · `Light` · `Camera` · `Path` · `Math` · `Time` · `Input` · `Scene`

### Key Patterns

**Transform Chain (Mesh + Path)**
```
[Geometry] → [Transform] → [Scene Output]
[Path]     → [Transform] → [Camera / Light]
```
Dragging a node's gizmo auto-creates a Transform node if none exists.

**Path Constraint**
Cameras and lights follow a path by connecting via the `path` port. Transform nodes in the chain set the path's position and rotation. Position/Rotation properties on the camera/light show live world coordinates.

---

## Geometry Nodes

Box · Sphere · Plane · Torus · Cylinder · Capsule · Icosphere — all with full segment controls.

---

## Getting Started

```bash
pnpm install
pnpm dev
```

Requires Node 18+.

---

## Roadmap

- [x] Phase 1 — Foundation: R3F + Node Editor + first render
- [x] Phase 2 — Properties Panel + Node Palette + node types (Geometry, Material, Light, Transform)
- [x] Phase 3 — Time, Math & live evaluation
- [x] Phase 4 — Dual Viewport, Gizmos, Scene Explorer, Camera node, dark theme
- [x] Phase 5a — Path nodes (Line/Circle/Arc), path constraints for Camera/Light, path gizmos
- [ ] Phase 5b — glTF Import Node
- [ ] Phase 5c — Custom GLSL Shader nodes + Textures
- [ ] Phase 6 — Export (React component, standalone HTML), Post-Processing, Save/Load

---

## License

MIT

# Th3ditor

**A node-based 3D scene editor that runs in the browser.** Build animated Three.js scenes visually — connect geometry, materials, lights, transforms, and shaders in a graph, and see the result render in real time.

> Built by DMA — Interface Design & Design Engineering.

---

## Features

- **Node Graph** — visual programming interface powered by ReactFlow; connect nodes to compose scenes
- **Live 3D Viewport** — React Three Fiber canvas with orbit controls, grid, and real-time scene updates
- **Properties Panel** — per-node controls: sliders, color pickers, toggles, selects
- **Live Animation** — Time and Math nodes drive per-frame updates via a dedicated live evaluator
- **Resizable Layout** — all panel borders are draggable (viewport, graph, properties)
- **Dark Warm UI** — custom OKLCH-based design tokens, orange accent, zero border-radius

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

The graph compiles into a Three.js scene description on every structural change. Per-frame updates (time, mouse) run through a separate live evaluator — no full recompile on every frame.

```
[Graph Store] → [Compiler (topo-sort)] → [CompiledScene] → [SceneRenderer (R3F)]
                                                                      ↓
                                                             [useFrame loop]
                                                                      ↓
                                                             [Live Evaluator]
                                                             (Time, Mouse, Math)
```

### Node Categories

`Geometry` · `Material` · `Transform` · `Light` · `Camera` · `Math` · `Time` · `Input` · `Scene`

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
- [x] Phase 2 — Properties Panel + Node Palette + more node types
- [x] Phase 3 — Time, Math & live evaluation
- [ ] Phase 4 — Dual Viewport, Gizmos, Scene Explorer
- [ ] Phase 5 — Custom GLSL Shader nodes + Textures
- [ ] Phase 6 — Export (React component, standalone HTML), Post-Processing, Save/Load

---

## License

MIT

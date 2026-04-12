# Web Visual Studio — Projektplan

## Vision

Node-basierter 3D/2D Visual Editor für das Web. Ziel: Animierte Szenen mit Geometrie, Shading, Lichtern, Effekten und prozeduraler Animation erstellen und als Web-Komponenten exportieren.

**Für:** Designer und 3D Artists
**Nicht:** Modelling-Tool, Keyframe-Timeline (vorerst)
**Kern-Stärke:** Node-Based Scene Building + GLSL Shading im Browser

---

## Architektur-Entscheidungen

- **Three.js + React Three Fiber (R3F)** — deklaratives Scene-Rendering via React
- **@xyflow/react (ReactFlow)** — Node-Editor, React-native, TypeScript-first
- **react-resizable-panels** — verschiebbare Panel-Grenzen (alle Trennlinien)
- **Zustand** — Multi-Store State Management (graph, editor, scene)
- **GLSL** — Custom Shader Materials, Noise/Color-Utilities im Shader-Graph-Compiler
- **Theatre.js** — nicht im Plan. Prozedurale Animation via Time/Math-Nodes reicht für v1.

---

## Layout

```
┌─ Header ───────────────────────────────────────────────────────────────────────┐
├─ 3D Viewport (Editor) ──────────────────┬─ Kamera Viewport (Final Render) ─── │
│  [Scene Explorer Overlay oben links]    │                                      │
│  [Shading | Perspektiv Toggle oben re.] │  Gleiche Szene, Szenen-Kamera        │
│  [Play | Pause | Stop  unten mitte]     │  Kein Overlay, kein UI               │
├─ Node Graph ────────────────────────────┴──────────────────┬─ Properties ───── │
└─ Footer ────────────────────────────────────────────────────┴───────────────── ┘
```

**Alle Trennlinien verschiebbar** via `react-resizable-panels`

**Dual Viewport** — zwei separate R3F Canvas:
- Linker View: Editor-Kamera (OrbitControls, Grid, Gizmos, Wireframe-Option)
- Rechter View: Szenen-Kamera aus Node Graph (Final Look, kein Overlay)

---

## UI Style

```css
:root {
  --bg-base:      oklch(45% 0.008 48); /* Haupt-Hintergrund — warm dunkelbraun    */
  --bg-panel:     oklch(50% 0.008 48); /* Panel-Hintergrund (Node Graph, Props)   */
  --bg-elevated:  oklch(60% 0.008 48); /* Erhöhte Elemente (Cards, Dropdowns)     */
  --bg-viewport:  oklch(40% 0.008 48); /* 3D Viewport — noch etwas dunkler        */
  --border:       oklch(55% 0.008 48); /* Subtile Panel-Grenzen                   */
  --text-primary: oklch(90% 0.010 48); /* Primärtext — warm off-white             */
  --text-muted:   oklch(80% 0.010 48); /* Labels, Metadaten                       */
  --accent:       oklch(70% 0.18  48); /* Leuchtendes Orange — Nodes, Ports, Focus*/
}
```

**Prinzipien:** UI tritt zurück, kein `border-radius`, Blender-style Controls.

---

## Farbraum-Strategie

| Kontext | Farbraum |
|---|---|
| UI Design Tokens | OKLCH |
| Color Picker (Properties) | HEX / RGB / HSL primär |
| Color Ops / Ramp | OKLCH intern (kein Grau-Schmutz bei Interpolation) |
| Three.js / PBR Materials | Linear RGB |
| GLSL Shader intern | Linear RGB |

---

## Node-Roadmap

### Implementiert ✅
| Kategorie | Nodes |
|---|---|
| Geometry | Box, Sphere (Quad), Plane, Torus, Cylinder, Capsule, Icosphere |
| Material | Standard PBR (7 Texture-Ports), Unlit |
| Object | Mesh, Group, Null Object, glTF Import |
| Transform | Translate, Rotate, Scale |
| Light | Ambient, Directional, Point, Area (RectArea) |
| Camera | Perspective, Orthographic |
| Path | Line, Circle, Arc |
| Time | Time, Sin(Time), Delta |
| Math | Add, Subtract, Multiply, Divide, Sin, Cos, Lerp, Clamp, Remap, Abs |
| Input | Mouse, Screen Size |
| Texture | Image, Noise (fBm/Ridged/Voronoi), Normal Map |
| Color Ops | Mix, HSL Shift |
| Shader (Visual Graph) | UV, Time, Mouse, Position, Noise (fBm/Ridged/Voronoi 3D), Gradient, Mix, Math, Color, Number, Output |
| Scene | Scene Output |

### Nächste Schritte
| Kategorie | Nodes | Zweck |
|---|---|---|
| Shader (Visual Graph) | **Color Ramp** (`shader/colorramp`) | Multi-Stop Gradient sfloat→svec3, ersetzt shader/gradient |
| Shader (Visual Graph) | **Domain Warp** (`shader/domainwarp`) | Noise-in-Noise, organische Blob-Effekte |
| Texture | **Color Ramp** (`texture/colorramp`) | Graustufentextur → mehrfarbig remappen |
| Shader (Visual Graph) | Mehr Noise-Typen (Curl, Worley) | Erweiterte Effekte |

### Längerfristig
| Kategorie | Nodes |
|---|---|
| Import | FBX, OBJ (Multi-Format Expand-to-Graph) |
| Post-Processing | Bloom, Vignette, DOF, SSAO |
| Environment | Procedural Sky, Fog |
| Instancing | Scatter, Instance Grid, Instance Along Curve |
| Node System | Compound Nodes (Subgraphs) |

---

## Projektstruktur

```
src/
  types/
    node-graph.ts                     # Node, Edge, Port, PortType, NodeDefinition
    properties.ts                     # PropertyDef

  store/
    editor-store.ts
    graph-store.ts
    scene-store.ts
    animation-store.ts
    evaluator-store.ts

  graph-engine/
    compiler.ts
    node-registry.ts
    type-system.ts
    evaluator.ts
    shader-graph-compiler.ts          # Shader Graph → GLSL Compiler
    node-definitions/
      geometry.ts
      material.ts
      transform.ts
      light.ts
      camera.ts
      shader.ts
      shader-graph.ts                 # Alle Shader-Graph-Nodes
      math.ts
      color-ops.ts
      texture.ts
      time.ts
      input.ts
      path.ts
      scene.ts

  components/
    editor/
    viewport/
      SceneRenderer.tsx               # MeshShaderGraphMaterial + MeshPBRShaderGraphMaterial
    graph/
    properties/
      controls/
        TextAreaControl.tsx

  utils/
    color.ts
    download.ts
```

---

## Rendering-Pipeline

```
[Graph Store] --mutation--> [Compiler (topo-sort)] --CompiledScene--> [SceneRenderer (R3F)]
                                                                            |
                                                                      [useFrame loop]
                                                                            |
                                                                      [Live Evaluator]
                                                                      (Time, Mouse)
```

- **Strukturelle Änderungen** → full recompile
- **Per-Frame Updates** → nur dynamic subgraph evaluieren

### Shader Graph Pipeline
```
[shader/position] → [shader/domainwarp] → [shader/noise] → [shader/colorramp] → [shader/output]
                                                                                       ↓
                                               Unlit (→ Mesh): custom ShaderMaterial
                                               PBR (→ Material → Mesh): onBeforeCompile
                                               Background (→ Scene Output): fullscreen quad
```

---

## Phasen-Plan

### Phase 1–4 ✅ DONE
Foundation, Properties Panel, Zeit/Math, Viewport/Gizmos/Layout.

### Phase 5a ✅ DONE
Path Nodes, Camera/Light Path Constraints, Look-Ahead.

**⚠️ Deferred Bug: Camera Look-Ahead Bounce auf rotierten Circle Paths**
Root Cause vermutlich in `evaluatePathTangent` (finite difference) oder `applyEulerXYZ`. Nächster Ansatz: analytische Tangente statt finite difference.

### Phase 5b ✅ DONE
glTF Import Node, Null Object, Origin Control, Timeline Scrubber, Smooth Shading, HDR IBL, FileControl, ViewCube-Fix.

### Phase 5c ✅ DONE
Area Light (RectAreaLight), Custom Editor Visual.

### Phase 5d ✅ DONE (mit Ausnahmen)
Texture Nodes (Image/Noise/Normal), PBR Material, Shadow Support, Color Nodes, glTF Expand to Graph.

- [ ] Custom GLSL Shader-Node (TextAreaControl + raw GLSL) — noch offen

### Phase 5e 🔄 IN PROGRESS
glTF Expand to Graph fertig. Multi-Format ausstehend:
- [ ] FBX (THREE.FBXLoader)
- [ ] OBJ (THREE.OBJLoader + MTLLoader)

### Visual Shader Graph ✅ DONE
- Nodes: UV, Time, Mouse, Position, Noise (fBm/Ridged/Voronoi 3D), Gradient, Mix, Math, Color, Number, Output
- 3 Rendering-Modes: Unlit (→ Mesh), PBR (→ Material → Mesh), Background (→ Scene Output)
- Vertex Displacement + Finite-Difference-Normals (eps=0.1, clamp ±1.5)
- shader/position: object-space 3D noise (keine UV-Seam)
- True 3D Voronoi (27-Neighbor), 3D fBm, Ridged Noise

### Shader Graph Erweiterungen 🔜 NEXT
- [ ] **Color Ramp** — `shader/colorramp` + `texture/colorramp`: Multi-Stop sfloat→svec3
- [ ] **Domain Warp** — `shader/domainwarp`: Noise-in-Noise (Ina Quilez Technik) → organische Blobs
- [ ] Curl Noise, Worley Noise als weitere Noise-Typen

### Phase 6: Export + Polish
- [ ] Export als React+R3F-Komponente
- [ ] Export als standalone HTML+Three.js
- [ ] Video-Export via MediaRecorder
- [ ] Post-Processing: Bloom, Vignette, DOF via `@react-three/postprocessing`
- [ ] Projekt Save/Load (JSON)
- [ ] Undo/Redo

### Phase 7: Compound Node System (Nested Subgraphs)
- [ ] Node-Selektion → "Group" → Compound-Node mit auto-generierten In/Out-Ports
- [ ] Doppelklick navigiert in Sub-Graph
- [ ] Compiler: Sub-Graphs inlinen vor Compile-Schritt

---

## Bekannte Limitationen

- **Displacement Geo-Dichte:** min. 5× Mesh-Kantenlänge < Noise-Feature-Größe. Sphere max 256 Segs, Icosphere max 256 Detail (~1.3M Tris).
- **Cylinder/Capsule Cap-Rim UV-Seam:** Getrennte UV-Islands → Spalt bei Displacement. Nicht lösbar ohne Quad-Meshes.
- **PBR Displacement Normals:** Finite-Diff-Normals bei hochfrequentem Voronoi noch nicht perfekt (prinzipielle Limitation bei scharfen Gradienten).
- **Camera Look-Ahead Bounce:** Auf rotierten Circle Paths. Deferred.

---

## Entschiedene Nicht-Ziele (v1)

- **Theatre.js** — UI-Konflikt, hoher Aufwand
- **Keyframe-Timeline** — zu komplex; Loop via Time/Math-Nodes reicht
- **Modelling** — kein Mesh-Editing
- **Blender Quad-Mesh Assets** — Quad-Sphere reicht; Cylinder/Capsule-Seam deferred

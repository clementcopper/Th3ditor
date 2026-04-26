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
┌─ Toolbar ──────────────────────────────────────────────────────────────────────┐
├─ 3D Viewport (Editor) ──────────────────┬─ Kamera Viewport (Final Render) ────┤
│  [ViewCube oben rechts]                 │                                      │
│  [Playbar + Shading/Persp + Max  unten] │  Gleiche Szene, Szenen-Kamera        │
│                                         │  [Maximize unten rechts]             │
├──────────────────────────────[▼]────────┴──────────────────┬─ Properties ──── │
│  Node Graph                                                 │  Scene Explorer  │
│                                                             │  Properties      │
└─────────────────────────────────────────────────────────────┴────[◀]────────── ┘
│  Status Bar                                                                    │
```

**Alle Trennlinien verschiebbar** via `react-resizable-panels`

**Dual Viewport** — zwei separate R3F Canvas:
- Linker View: Editor-Kamera (OrbitControls, Grid, Gizmos, Wireframe-Option)
- Rechter View: Szenen-Kamera aus Node Graph (Final Look, kein Overlay)

**Viewport Maximize** — CSS `absolute inset-0 z-10` Overlay (kein R3F-Remount, kein WebGL-Kontext-Verlust). `maximizedViewport: 'vp3d' | 'cam' | null` in EditorLayout-State.

**Panel Collapse Buttons** — `BorderCollapseBtn` sitzt innerhalb des Panels direkt an der Grenze (top-0 / left-0), Farbe = `border-default`, hover = accent, runde Ecken auf der Panel-Seite (`.panel-collapse-btn-h/v`, `--radius-panel-btn`).

**Playbar Stacking** — bei Viewport-Breite < 820px: Playbar hebt sich über die Controls-Leiste (full-width, `left-3 right-3`). `ResizeObserver` in `Viewport3D` und `CamMaxOverlay`.

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
| Time | Time (Linear/Sine/Sawtooth/Square/Bounce/Ease In/Ease Out/Ease In-Out + Speed/Offset) |
| Math | Add, Subtract, Multiply, Divide, Sin, Cos, Lerp, Clamp, Remap, Abs |
| Input | Mouse, Screen Size |
| Texture | Image, Noise (fBm/Ridged/Voronoi), Normal Map |
| Color Ops | Mix, HSL Shift |
| Shader (Visual Graph) | UV, Time, Mouse, Position, Noise (fBm/Ridged/Voronoi/Worley/Curl 3D), Color (Color/Mix/Ramp modes), Math, Band, Component, Domain Warp, Pattern (Dots/Lines), Output |
| Scene | Scene Output |

### Nächste Schritte
| Kategorie | Nodes | Zweck |
|---|---|---|
| Shader (Visual Graph) | Time-Modes (ease-in/ease-out) | Ungleichmäßigen Zeitverlauf |

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

### Phase 5e ✅ DONE
glTF Expand to Graph fertig. FBX/OBJ zurückgestellt (GLTF reicht für v1).
Shader Color konsolidiert (shader/color mit Color/Mix/Ramp-Modes, value+alpha-Outputs). ColorControl vereinheitlicht.

### Visual Shader Graph ✅ DONE
- Nodes: UV, Time, Mouse, Position, Noise (fBm/Ridged/Voronoi/Worley/Curl 3D), Color (Color/Mix/Ramp), Math, Band, Component, Domain Warp, Output
- **Shader Color konsolidiert:** shader/color, shader/mix, shader/gradient, shader/colorramp → `shader/color` (Mode: Color / Mix / Ramp). Value-Output (sfloat = Luminanz) für Displacement direkt aus Color-Ramp.
- **Multi-Output Compiler:** `portVar`-Map für Nodes mit mehreren Output-Typen (color, value, alpha)
- **ColorControl vereinheitlicht:** Canonical in `properties/controls/`, tool panel re-exportiert
- 3 Rendering-Modes: Unlit (→ Mesh), PBR (→ Material → Mesh), Background (→ Scene Output)
- Vertex Displacement + Finite-Difference-Normals (eps=0.1, clamp ±1.5)
- Math: Number/Add/Subtract/Multiply/Sin/Cos/Abs/Clamp/Lerp/Fract

**Shading Bug: Shader-Noise-Displacement Interferenzen an Polen — ✅ FIXED**
Ursache: tangent/bitangent-basierte finite differences hatten eine harte Diskontinuität bei abs(normal.y)=0.99. Fix: achsenausgerichtete 3D-Gradientenabtastung (X/Y/Z-Offsets) + Projektion auf Tangentialebene.

### Shader Graph Erweiterungen 🔜
- [ ] **Shader Time Node Modes** — ease-in/ease-out, Sawtooth, Square, Bounce usw.
- [x] **Shader Pattern (Dots)** — Grid / Hex / Diagonal Layouts, Softness, Radius, Time-Animation-Port, Mouse-Effects (Attract/Repel/Grow/Shrink mit Radius + Strength), Outputs: Color, Value
- [x] **Shader Pattern (Lines)** — Angle, Width, Softness, Time-Animation-Port, Outputs: Color, Value

### 3D Graph Erweiterungen
- [x] **Time Node Modes** — Linear, Sine, Sawtooth, Square, Bounce, Ease In, Ease Out, Ease In-Out; Speed + Offset Properties; einheitlicher `value`-Output

### Phase 6: Export + Polish 🔜 NEXT
- [x] **Projekt Save/Load (JSON)** — `.wvs` File-Download + File-Open, `src/utils/project.ts`
- [x] **Undo/Redo** — Snapshot-basiert in `graph-store.ts` (`_history`/`_future`, max 50), Cmd+Z/Cmd+Shift+Z, Toolbar-Buttons. Snapshot-Trigger: node drag start, node/edge delete, addNode/addEdge/removeEdge, property interaction start (slider pointerdown/wheel/commit, color picker open/first touch, select/toggle/colorramp change).
- [x] **UI Polish** — Viewport Maximize/Minimize (CSS Overlay), Playbar-Stacking (ResizeObserver), Panel-Collapse-Buttons (BorderCollapseBtn, merged mit Border), hover states auf allen Viewport-Controls, konsistente 26px Control-Bars.
- [x] **Geometry Polish** — Quad-Box, Quad-Sphere, Quad-Torus, Quad-Cylinder, Quad-Capsule; einzelner `Segments`-Slider pro Typ mit proportionaler Sekundär-Berechnung in `normalizeGeoProps`.
- [x] **Viewport Polish** — Origin-Indicator (RGB LineSegments, konstante Screengröße), Camera-Icon Pyramidenspitze am Origin, OrbitControls-Damping in Ortho deaktiviert.
- [x] **Properties Controls Polish** — `SliderControl`: getrennter Drag-Balken + Textfeld in einer Zeile. `ColorControl`: R/G/B/A als Drag-Slider (`ChannelSlider`), HEX schmal, Dropdown-Breite = Header-Breite. `SelectControl`: Toggle-Button Hover-Style vereinheitlicht.
- [x] **Shader Pattern Node** — `shader/pattern` mit Dots (Grid/Hex/Diagonal) + Lines-Modus. Aspect-Ratio-Fix (quadratische Pixel-Zellen), Time-Animation-Port, Mouse-Interaktion (Attract/Repel/Grow/Shrink) für alle Layouts mit pixel-korrektem Kreisradius.
- [ ] Export als React+R3F-Komponente
- [ ] Export als standalone HTML+Three.js
- [ ] Image-Export via ? (.png,.jpg)
- [ ] Image-Sequence-Export 
- [ ] Video-Export via MediaRecorder
- [ ] Post-Processing: Bloom, Vignette, DOF via `@react-three/postprocessing` z.B via Scene-Output-Node


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

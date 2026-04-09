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
- **@react-three/drei `<View>`** — Dual Viewport in einem WebGL-Context (geteilte Ressourcen)
- **Zustand** — Multi-Store State Management (graph, editor, scene)
- **GLSL** — Custom Shader Materials, Noise/Color-Utilities als Snippet-Bibliothek
- **Theatre.js** — nicht im Plan. Prozedurale Animation via Time/Math-Nodes reicht für v1.

---

## Layout

Referenz: `Web Visual Studio Layout.png`

```
┌─ Header ───────────────────────────────────────────────────────────────────────┐
├─ 3D Viewport (Editor) ──────────────────┬─ Kamera Viewport (Final Render) ─── │
│  [Scene Explorer Overlay oben links]    │                                      │
│  [Shading | Perspektiv Toggle oben re.] │  Gleiche Szene, Szenen-Kamera        │
│  [Play | Pause | Stop  unten mitte]     │  Kein Overlay, kein UI               │
├─ Node Graph ────────────────────────────┴──────────────────┬─ Properties ───── │
└─ Footer ────────────────────────────────────────────────────┴───────────────── ┘
```

**Alle Trennlinien verschiebbar** via `react-resizable-panels`:
- Vertikal zwischen 3D Viewport und Kamera Viewport
- Horizontal zwischen Viewport-Reihe und Node Graph
- Vertikal zwischen Node Graph und Properties

**Dual Viewport** — ein R3F Canvas, zwei `<View>` Bereiche:
- Linker View: Editor-Kamera (OrbitControls, Grid, Gizmos, Wireframe-Option)
- Rechter View: Szenen-Kamera aus Node Graph (Final Look, kein Overlay)

**Scene Explorer** — `<div>` absolut über 3D Viewport oben links, liest Graph Store. Kein eigenes Panel.

**Play/Pause/Stop** — Bottom-Overlay im 3D Viewport (ab Phase 4, vorher im Header).

---

## UI Style

Zwischen Three.js Editor (zu hell) und Theatre.js (zu dunkel) — leicht warm, dunkel.

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

**Prinzipien:**
- UI tritt zurück — 3D-Inhalt steht im Vordergrund
- Keine harten Kontraste zwischen Panels — fließende Hierarchie durch Helligkeit
- Blender-style Controls passen direkt ins Dark Theme
- **`border-radius: 0`** überall — keine abgerundeten Ecken in der gesamten UI

---

## Farbraum-Strategie

| Kontext | Farbraum | Begründung |
|---|---|---|
| UI Design Tokens | OKLCH | Perceptually uniform, vorhersehbare Helligkeitsverläufe — nur intern |
| Color Picker (Properties) | HEX / RGB / HSL primär, OKLCH optional | Zielgruppe kennt HEX/HSL aus Figma, CSS, 3D-Tools |
| Color Ops Nodes (Mix, Ramp, Gradient) | OKLCH intern | Interpolation ohne Grau-Schmutz in der Mitte |
| Übergabe an Three.js | Linear RGB | Three.js erwartet linear RGB — Konvertierung via `utils/color.ts` |
| GLSL Shader intern | Linear RGB | Physikalisch korrekt für Lichtberechnung |
| PBR Materials | Linear RGB | MeshStandardMaterial erwartet lineare Werte |

**Konvertierungsschicht:** `utils/color.ts` enthält bereits alle Konvertierungen (OKLCH, HSL, RGB, HEX).

---

## Was bleibt / was geht

### Behalten & anpassen
- `src/components/tool/controls/` — SliderControl, ColorControl, ToggleControl, SelectControl
- `src/utils/color.ts` — Color-Space-Konvertierungen
- `src/utils/download.ts` — File-Download-Helper
- `src/index.css` — Tailwind-Theme mit OKLCH Design Tokens, Fira Sans + Fira Code
- `vite.config.ts` — Basis-Config anpassen

### Löschen
- `src/engine/` — custom WebGL2/WebGPU-Renderer
- `src/presets/` — Shader-Presets
- `src/shaders/presets/` — Preset-Shader-Dateien
- `src/export/` — Shader-spezifische Exporter
- `src/wasm/` + `crates/` — Naga WGSL-Validierung
- `src/workers/` — Render-Worker
- `src/store/shader-store.ts`
- `src/glsl.d.ts`, `src/wgsl.d.ts`
- `src/components/tool/` — ShaderCanvas, PresetGallery, ParameterPanel, Toolbar, PlaybackBar, ExportDialog, ToolLayout

### Archivieren (in `src/shaders/chunks/`)
- `src/shaders/common/noise-simplex.glsl`
- `src/shaders/common/noise-voronoi.glsl`
- `src/shaders/common/color-oklch.glsl`
- `src/shaders/common/math-utils.glsl`

---

## Projektstruktur

```
src/
  App.tsx
  main.tsx
  index.css                           # KEEP

  types/
    node-graph.ts                     # Node, Edge, Port, PortType, NodeDefinition
    properties.ts                     # PropertyDef (evolved ParameterDef)

  store/
    editor-store.ts                   # UI: selectedNode, viewMode, panelSizes
    graph-store.ts                    # Nodes, Edges, CRUD
    scene-store.ts                    # Compiled Scene (Output des Compilers)

  graph-engine/
    compiler.ts                       # Graph → Three.js Scene-Beschreibung (topo-sort)
    node-registry.ts                  # Registriert alle Node-Definitionen
    type-system.ts                    # Port-Typ-Kompatibilität
    live-evaluator.ts                 # Per-Frame: Time/Math/Input subgraph
    node-definitions/
      geometry.ts                     # Box, Sphere, Plane, Torus, Cylinder
      material.ts                     # Standard, Physical, Unlit, Shader
      transform.ts                    # Translate, Rotate, Scale
      light.ts                        # Ambient, Directional, Point, Spot
      camera.ts                       # Perspective, Orthographic
      shader.ts                       # Custom GLSL vertex/fragment
      math.ts                         # Add, Multiply, Sin, Cos, Lerp, Clamp, Remap
      color-ops.ts                    # Mix, HSL Shift, Gradient
      texture.ts                      # Image, Noise, Gradient, Checkerboard
      time.ts                         # Time, Sin(Time), Delta
      input.ts                        # Mouse, Screen Size
      scene.ts                        # Group, Scene Output (Terminal-Node)

  components/
    editor/
      EditorLayout.tsx                # react-resizable-panels Wurzel
      EditorHeader.tsx                # Dateiname, View-Optionen
      EditorFooter.tsx                # Status: Node Count, FPS

    viewport/
      ViewportPanel.tsx               # Hält beide Views + R3F Canvas
      EditorView.tsx                  # 3D Viewport: OrbitControls, Grid, Gizmos
      CameraView.tsx                  # Kamera Viewport: Final Look
      SceneRenderer.tsx               # Liest scene-store, rendert R3F-Elemente
      SceneExplorer.tsx               # Overlay über EditorView, liest graph-store
      Gizmos.tsx                      # TransformControls (@react-three/drei)

    graph/
      NodeEditor.tsx                  # ReactFlow-Wrapper
      NodeRenderer.tsx                # Custom Node-Komponente
      PortHandle.tsx                  # Farbcodierte Ports nach Typ
      NodePalette.tsx                 # Kategorisiert, suchbar, drag-to-add

    properties/
      PropertiesPanel.tsx             # Properties des selected Node
      controls/                       # KEEP
        SliderControl.tsx
        ColorControl.tsx
        ToggleControl.tsx
        SelectControl.tsx
        Vec3Control.tsx               # NEU: 3 verlinkte Slider

  utils/
    color.ts                          # KEEP
    download.ts                       # KEEP

  shaders/
    chunks/                           # Archivierte GLSL-Snippets
      noise-simplex.glsl
      noise-voronoi.glsl
      color-oklch.glsl
      math-utils.glsl
```

---

## Node-Roadmap

### Sofort (Phase 1–3, Fundament)
| Kategorie | Nodes |
|---|---|
| Geometry | Box, Sphere, Plane, Torus, Cylinder |
| Material | Standard, Physical, Unlit |
| Object | Mesh, Group |
| Transform | Translate, Rotate, Scale |
| Light | Ambient, Directional, Point, Spot |
| Camera | Perspective, Orthographic |
| Time | Time, Sin(Time), Delta |
| Math | Add, Subtract, Multiply, Divide, Sin, Cos, Lerp, Clamp, Remap, Abs, Floor, Fract |
| Input | Mouse, Screen Size |
| Scene | Scene Output (Terminal-Node) |

### Mittelfristig (Phase 4–5)
| Kategorie | Nodes |
|---|---|
| Shader | Custom GLSL (Vertex + Fragment, Uniform-Ports) |
| Texture | Image, Noise (Simplex/Voronoi), Gradient, Checkerboard |
| Color Ops | Mix, HSL Shift, Color Ramp, Invert |
| Post-Processing | Bloom, Vignette, DOF, SSAO, Color Grading — als Node-Chain im Graph |
| Environment | HDRI / Environment Map, Procedural Sky, Fog |

### Längerfristig (Phase 6+)
| Kategorie | Nodes |
|---|---|
| Instancing | Scatter (Geometrie auf Fläche verteilen), Instance Grid, Instance Along Curve |
| Import | GLTF Import (Modell als Node), Texture Import |
| Procedural Geometry | Noise Displacement, Subdivision, Boolean (CSG) |
| Event / Logic | On Click, On Hover, Timer, If/Switch — für interaktive Szenen |
| Particles | GPU Particle System (WebGPU-basiert) |
| Physics | Rigid Body, Constraint (Cannon.js / Rapier) |
| UI / Widget | HTML Overlay Node, Billboard Text |

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

- **Strukturelle Änderungen** (Node/Edge add/remove) → full recompile
- **Per-Frame Updates** (Time, Mouse) → nur dynamic subgraph evaluieren

---

## Phasen-Plan

### Phase 1: Foundation — R3F + Node-Editor + erster Render ✅ DONE
- [x] Dependencies: three, @react-three/fiber, @react-three/drei, @xyflow/react
- [x] Cleanup: custom Renderer, Shader-Presets, Export, WASM entfernt
- [x] types/node-graph.ts + types/properties.ts
- [x] store/graph-store.ts + editor-store.ts + scene-store.ts
- [x] graph-engine/compiler.ts + node-registry.ts
- [x] NodeEditor.tsx (ReactFlow) + NodeRenderer.tsx
- [x] Viewport3D.tsx (R3F Canvas + OrbitControls + Grid)
- [x] SceneRenderer.tsx
- [x] EditorLayout.tsx
- [x] **Ergebnis:** 4 verbundene Nodes → blauer Würfel im Viewport

### Phase 2: Properties Panel + mehr Nodes + Node Palette ✅ DONE
- [x] PropertiesPanel mit SliderControl, ColorControl, ToggleControl, SelectControl
- [x] NodePalette: kategorisiert, suchbar, click-to-add
- [x] Geometrien: Box, Sphere, Plane, Torus, Cylinder
- [x] Lights: Ambient, Directional, Point
- [x] Transforms: Translate, Rotate, Scale (mit ° Suffix)
- [x] Port-Typ-Validierung + farbcodierte Handles
- [x] Compiler: Transform-Chain + Lights

### Phase 3: Zeit, Math & Live-Evaluation ✅ DONE
- [x] Time-Node, Sin(Time)-Node
- [x] Math-Nodes: Add, Multiply, Sin, Cos, Lerp, Clamp, Remap
- [x] Input-Nodes: Mouse, Screen Size
- [x] Live-Evaluator: useFrame loop evaluiert dynamic subgraph per Frame
- [x] Float-Ports: Time/Math/Input → Material/Transform/Geometry
- [x] Play/Pause/Stop im EditorHeader (wird Phase 4 in Viewport verschoben)

### Phase 4: Viewport Polish + Gizmos + Scene Explorer
- [x] UI Style: Dark Theme + Orange Akzent + border-radius 0
- [x] react-resizable-panels — alle Panel-Grenzen verschiebbar
- [x] Layout-Fix: Properties Panel nur neben Node Graph (untere Reihe), nicht full-height
- [x] Dual Viewport: zwei separate R3F Canvas — Editor links, Kamera rechts
- [x] Camera-Node: positionX/Y/Z + FOV, verbindet sich mit Scene Output camera-Port
- [x] Scene Explorer Overlay (oben links im 3D Viewport)
- [x] Play/Pause/Reset + Zeitanzeige als Bottom-Overlay im 3D Viewport
- [x] Shading-Toggle: Shaded / Wireframe (oben rechts, nur EditorView)
- [x] Perspektiv-Toggle: Perspektiv / Orthogonal (oben rechts im 3D Viewport)
- [x] Gizmos: TransformControls (T/R/S) für Meshes, Lights und Camera im EditorView
- [x] 3D Viewport Representationen: Sphere-Icon für Lights, Box-Icon für Camera (klickbar)
- [x] Scene Explorer: zeigt nur Mesh/Light/Camera-Nodes mit Type-Icons
- [x] Camera-Node: rotationX/Y/Z ergänzt; CameraView wendet Rotation an
- [x] Default-Graph beim Start: Directional Light + Camera Node bereits verbunden, zentriert via `useNodesInitialized`
- [x] Light-Icons: Point-Light = Wireframe-Sphere, Directional-Light = Wireframe-Kegel (dynamisch auf Ziel ausgerichtet)
- [x] Camera-Icon: Wireframe-Pyramide, Grundplatte zeigt Sichtrichtung
- [x] Grid: warme Farben, fadeStrength 0.3 (kein starkes Ausblenden)

### Phase 5: glTF Import + Custom Shaders + Texturen

#### 5a: glTF Import Node
- [ ] Node-Typ `object/gltf` — Kategorie `object`, Output-Port `mesh`
- [ ] Property: File-Picker Button (lokale Datei) + Dateiname-Anzeige
- [ ] Lädt via `THREE.GLTFLoader` — rendert Modell mit seinen eigenen Materialien
- [ ] Kette: `[glTF Import] → [Transform] → [Scene Output]`
- [ ] Scene Explorer zeigt glTF-Node wie andere Objekte
- [ ] Test-Modelle: `glTF/red-brick-3d-model`, `glTF/western-electric-tangent-galvanometer-3d-model`
- [ ] Compiler + SceneRenderer: neuer `CompiledGLTF`-Typ neben `CompiledMesh`

#### 5b: Custom Shaders + Texturen
- [ ] Custom GLSL Shader-Node (Vertex + Fragment, Uniform-Ports)
- [ ] GLSL-Code Editor (TextArea-Control mit Monospace)
- [ ] GLSL-Chunks als inkludierbare Snippets
- [ ] Texture-Nodes (Image, Noise, Gradient)
- [ ] Color-Ops-Nodes (Mix, HSL Shift, Ramp)

### Phase 6: Export + Post-Processing + Polish
- [ ] Export als React+R3F-Komponente
- [ ] Export als standalone HTML+Three.js
- [ ] Video-Export via MediaRecorder
- [ ] Post-Processing: Bloom, Vignette, DOF via `@react-three/postprocessing`
- [ ] Projekt Save/Load (JSON)
- [ ] Undo/Redo

---

## Dependencies

```
+ three
+ @types/three
+ @react-three/fiber
+ @react-three/drei
+ @xyflow/react
+ react-resizable-panels     ← neu (Phase 4)
- @webgpu/types
- vite-plugin-glsl
```

---

## Entschiedene Nicht-Ziele (v1)

- **Theatre.js** — UI-Stil-Konflikt, zu hoher Integrationsaufwand; keine extrahierbaren UI-Komponenten
- **Keyframe-Timeline** — zu komplex für v1; Loop-Animation via Time/Math-Nodes ist der Kern-Use-Case
- **Modelling** — kein Mesh-Editing, nur Szenen-Komposition
- **Three.js Editor Integration** — Vanilla JS, kein React, Aufwand nicht gerechtfertigt

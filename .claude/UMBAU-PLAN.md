# Plan: Shadertool → Web Visual Studio

## Context
Das aktuelle Shadertool ist ein Fullscreen-Shader-Previewer mit eigenem WebGL2/WebGPU-Renderer. Der Ansatz ist zu limitiert — es können nur 2D-Shader-Presets gerendert werden. Das Projekt wird komplett umgebaut zu einem **node-basierten 3D/2D Visual Editor** namens **Web Visual Studio**, basierend auf Three.js + React Three Fiber + GLSL. Ziel: animierte 2D- und 3D-Szenen erstellen und als Web-Komponenten exportieren.

---

## Architektur-Entscheidungen

- **Three.js + React Three Fiber (R3F)** ersetzt den custom WebGL2/WebGPU-Renderer — deklaratives Scene-Rendering via React
- **@xyflow/react (ReactFlow)** für den Node-Editor — React-native, TypeScript-first, Nodes sind React-Komponenten (können die bestehenden Controls direkt nutzen)
- **Theatre.js** für Animation — `@theatre/core` als Keyframe-Engine + Runtime, `@theatre/studio` als Timeline-UI (Phase 5A), später eigenes Timeline-UI (Phase 5B)
- **Zustand** bleibt als State-Management (Multi-Store: graph, editor, scene)
- **GLSL** bleibt für Custom Shader Materials — die bestehenden Noise/Color-Utility-Shader werden als Snippet-Bibliothek archiviert

---

## Was bleibt / was geht

### Behalten & anpassen
- `src/components/tool/controls/` — SliderControl, ColorControl, ToggleControl, SelectControl (Import-Pfad für `ParameterDef` → `PropertyDef` ändern)
- `src/utils/color.ts` — Color-Space-Konvertierungen (drop-in)
- `src/utils/download.ts` — File-Download-Helper (drop-in)
- `src/index.css` — Tailwind-Theme mit OKLCH Design Tokens (drop-in)
- `vite.config.ts` — Basis-Config (anpassen)
- Layout-Pattern aus `ToolLayout.tsx` → `EditorLayout.tsx`

### Löschen
- `src/engine/` — kompletter custom Renderer
- `src/presets/` — Shader-Presets
- `src/shaders/presets/` — Preset-Shader-Dateien
- `src/export/` — Shader-spezifische Exporter
- `src/wasm/` + `crates/` — Naga WGSL-Validierung
- `src/workers/` — Render-Worker
- `src/store/shader-store.ts` — Shader-Store
- `src/glsl.d.ts`, `src/wgsl.d.ts`
- `src/components/tool/ShaderCanvas.tsx`, `PresetGallery.tsx`, `ParameterPanel.tsx`, `Toolbar.tsx`, `PlaybackBar.tsx`, `ExportDialog.tsx`, `ToolLayout.tsx`

### Archivieren (in `src/shaders/chunks/`)
- `src/shaders/common/noise-simplex.glsl` — Simplex Noise
- `src/shaders/common/noise-voronoi.glsl` — Voronoi
- `src/shaders/common/color-oklch.glsl` — OKLCH Color
- `src/shaders/common/math-utils.glsl` — Math Utilities

---

## Neue Projektstruktur

```
src/
  App.tsx
  main.tsx
  index.css                         # KEEP

  types/
    node-graph.ts                   # Node, Edge, Port, PortType, NodeDefinition
    properties.ts                   # PropertyDef (evolved ParameterDef — gleiche Shape)

  store/
    editor-store.ts                 # UI: selectedNode, viewMode, sidebarOpen
    graph-store.ts                  # Nodes, Edges, CRUD
    scene-store.ts                  # Compiled Scene (Output des Graph-Compilers)

  graph-engine/
    compiler.ts                     # Graph → Three.js Scene-Beschreibung
    node-registry.ts                # Registriert alle Node-Definitionen
    type-system.ts                  # Port-Typ-Kompatibilität
    node-definitions/
      geometry.ts                   # Box, Sphere, Plane, Torus, Cylinder
      material.ts                   # Standard, Physical, Unlit, Shader
      transform.ts                  # Translate, Rotate, Scale
      light.ts                      # Ambient, Directional, Point, Spot
      camera.ts                     # Perspective, Orthographic
      shader.ts                     # Custom GLSL vertex/fragment
      math.ts                       # Add, Multiply, Sin, Cos, Lerp, etc.
      color-ops.ts                  # Mix, HSL Shift, Gradient
      texture.ts                    # Image, Noise, Gradient, Checkerboard
      time.ts                       # Time, Delta, Sin(Time)
      input.ts                      # Mouse, Screen Size
      scene.ts                      # Group, Scene Output (Terminal-Node)

  components/
    editor/
      EditorLayout.tsx              # Split: Graph | Viewport | Properties
      EditorToolbar.tsx
      ViewportTabs.tsx              # Viewport / Graph / Split toggle

    viewport/
      Viewport3D.tsx                # R3F Canvas + OrbitControls + Grid
      SceneRenderer.tsx             # Liest scene-store, rendert R3F-Elemente

    graph/
      NodeEditor.tsx                # ReactFlow-Wrapper
      NodeRenderer.tsx              # Custom Node-Komponente
      PortHandle.tsx                # Farbcodierte Ports nach Typ
      NodePalette.tsx               # Suchbare Node-Liste, Drag-to-Add

    properties/
      PropertiesPanel.tsx           # Zeigt Properties des selected Node
      controls/                     # KEEP: Slider, Color, Toggle, Select
        SliderControl.tsx
        ColorControl.tsx
        ToggleControl.tsx
        SelectControl.tsx
        Vec3Control.tsx             # NEU: 3 verlinkte Slider

  utils/
    color.ts                        # KEEP
    download.ts                     # KEEP

  shaders/
    chunks/                         # Archivierte GLSL-Snippets für Shader-Node
      noise-simplex.glsl
      noise-voronoi.glsl
      color-oklch.glsl
      math-utils.glsl
```

---

## Phasen-Plan

### Phase 1: Foundation (R3F + Node-Editor + erster Render)
**Ziel:** Flexible Bento-Grid-Layout (siehe: Web Visual Studio Layout.svg. Ein minimaler Graph (Geometry → Mesh → Material → Effekte → Scene Output) rendert ein sichtbares Objekt.

1. `package.json` updaten: `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `@xyflow/react` hinzufügen. `@webgpu/types`, `vite-plugin-glsl` entfernen.
2. Altes löschen: `src/engine/`, `src/presets/`, `src/shaders/presets/`, `src/export/`, `src/wasm/`, `crates/`, `src/workers/`, `src/store/shader-store.ts`, alte Komponenten (ShaderCanvas, PresetGallery, etc.), `glsl.d.ts`, `wgsl.d.ts`
3. GLSL-Snippets archivieren: `src/shaders/common/*.glsl` → `src/shaders/chunks/`
4. `types/node-graph.ts` + `types/properties.ts` erstellen (PropertyDef bewahrt ParameterDef-Shape)
5. `store/graph-store.ts` + `store/editor-store.ts` + `store/scene-store.ts` erstellen
6. `graph-engine/node-registry.ts` + `graph-engine/compiler.ts` erstellen
7. Erste Node-Definitionen: `geometry/box`, `material/standard`, `object/mesh`, `scene/output`
8. `components/graph/NodeEditor.tsx` (ReactFlow) + `components/graph/NodeRenderer.tsx`
9. `components/viewport/Viewport3D.tsx` (R3F Canvas + OrbitControls + Grid)
10. `components/viewport/SceneRenderer.tsx` (liest CompiledScene, rendert R3F)
11. `components/editor/EditorLayout.tsx` (Split-View)
12. `App.tsx` updaten → rendert `EditorLayout`
13. Wiring: Graph-Änderungen → Compiler → SceneRenderer

**Ergebnis:** 4 verbundene Nodes → ein blauer Würfel im Viewport. Material-Farbe ändern → Würfel-Farbe ändert sich live.

### Phase 2: Properties Panel + mehr Nodes + Node Palette
- Controls nach `components/properties/controls/` verschieben, Import `ParameterDef` → `PropertyDef`
- PropertiesPanel für selected Node
- NodePalette (kategorisiert, suchbar, drag-to-add)
- Mehr Geometrien (Sphere, Plane, Torus, Cylinder)
- Lights (Ambient, Directional, Point)
- Transform-Nodes (Translate, Rotate, Scale)
- Port-Typ-Prüfung + farbcodierte Handles

### Phase 3: Zeit, Math & Live-Evaluation
- Time-Node, Math-Nodes (Add, Multiply, Sin, Cos, Lerp, etc.)
- Live-Evaluator: Time-abhängige Nodes werden per `useFrame()` aktualisiert
- Mouse/Input-Nodes
- Play/Pause-Controls
- AnimationControls (adaptiert von PlaybackBar)

### Phase 4: Custom Shaders + Texturen
- Custom GLSL Shader-Node (Vertex + Fragment, Uniform-Ports)
- TextArea-Control für GLSL-Code
- GLSL-Chunks als inkludierbare Snippets
- Texture-Nodes (Image, Noise, Gradient)
- Color-Ops-Nodes (Mix, HSL Shift, Ramp)

### Phase 5A: Animation mit Theatre.js Studio
**Ziel:** Keyframe-Animation über Theatre.js Studio UI. Schnell funktional, UI-Konsistenz erstmal zweitrangig.

- `@theatre/core` + `@theatre/studio` + `@theatre/r3f` installieren
- Theatre.js Studio als Overlay aktivieren (unterer Bereich)
- Node-Properties als Theatre.js Sheet Objects exponieren — animierbar über Studio-Timeline
- Play/Pause über Theatre.js Playback-Controls
- Animationsdaten als `state.json` serialisieren (für Export)
- `@theatre/r3f` für direkte R3F-Integration (editable Objects im Viewport)

**Ergebnis:** Animierbare Szenen mit professioneller Timeline. Theatre.js Studio UI ist visuell eigenständig (nicht im Web Visual Studio Stil), aber voll funktional.

### Phase 5B: Eigenes Timeline-UI (später)
**Ziel:** Theatre.js Studio durch eigenes Timeline-UI ersetzen, das in den Web Visual Studio Stil passt.

- `@theatre/studio` entfernen, nur `@theatre/core` behalten
- Eigenes Timeline-Panel (unten im Editor) mit unseren OKLCH Design Tokens
- Keyframe-Tracks mit Drag-and-Drop
- Graph Editor für Easing-Kurven
- `@theatre/core` API für Keyframe CRUD + Interpolation nutzen
- Rechtsklick "Add Keyframe" auf Properties im PropertiesPanel

**Ergebnis:** Visuell konsistentes Timeline-UI, gleiche Animation-Engine (`@theatre/core`).

### Phase 6: Export + Post-Processing + Polish
- Export als React+R3F-Komponente (inkl. `@theatre/core` + `state.json` für Animation)
- Export als standalone HTML+Three.js (mit Theatre.js Core Runtime)
- Video-Export via MediaRecorder
- Post-Processing (Bloom, Vignette, DOF via `@react-three/postprocessing`)
- Projekt Save/Load (JSON + Theatre.js state.json)
- Undo/Redo


---

## Dependencies (Phase 1)

```
+ three
+ @types/three
+ @react-three/fiber
+ @react-three/drei
+ @xyflow/react
- @webgpu/types
- vite-plugin-glsl
```

---

## Rendering-Pipeline

```
[Graph Store] --mutation--> [Compiler (topo-sort)] --CompiledScene--> [SceneRenderer (R3F)]
                                                                            |
                                                                      [useFrame loop]
                                                                            |
                                                                      [Live Evaluator]
                                                                      (time, mouse)
```

- **Strukturelle Änderungen** (Node/Edge add/remove) → full recompile
- **Per-Frame Updates** (Time, Mouse) → nur dynamic subgraph evaluieren

---

## Verifizierung (Phase 1)

1. `npm run dev` startet ohne Fehler
2. Split-View sichtbar: Node-Graph links, 3D-Viewport rechts
3. Default-Graph enthält 4 verbundene Nodes (Box → Standard Material → Mesh → Scene Output)
4. Blauer Würfel im Viewport sichtbar mit OrbitControls
5. Node-Property ändern (z.B. Material-Farbe) → Viewport aktualisiert sich live
6. Nodes können verbunden/getrennt werden
7. `npm run build` kompiliert ohne Fehler

# WVS-PLAN — Ergänzungen zu UMBAU-PLAN.md

Dieses Dokument enthält nur die Änderungen und Ergänzungen gegenüber `UMBAU-PLAN.md`.

---

## Namensänderung ? - to be decided!
**Web Visual Studio → Web Vision Studio**

---

## Architektur-Änderungen

- **`react-resizable-panels`** hinzufügen — alle Panel-Grenzen verschiebbar (war nicht im alten Plan)
- **`@react-three/drei <View>`** für Dual Viewport — ein WebGL-Context, zwei Render-Bereiche, geteilte Ressourcen
- **Theatre.js komplett gestrichen** — eigener UI-Stil nicht integrierbar; prozedurale Animation via Time/Math-Nodes reicht für v1

---

## Layout-Änderungen

Referenz: `.claude/Web Visual Studio Layout.png`

```
┌─ Header ───────────────────────────────────────────────────────────────────────┐
├─ 3D Viewport (Editor) ──────────────────┬─ Kamera Viewport (Final Render) ───  │
│  [Scene Explorer Overlay oben links]    │                                      │
│  [Shading | Perspektiv Toggle oben re.] │  Gleiche Szene, Szenen-Kamera        │
│  [Play | Pause | Stop  unten mitte]     │  Kein Overlay, kein UI               │
├─ Node Graph ────────────────────────────┴──────────────────┬─ Properties ───── │
└─ Footer ────────────────────────────────────────────────────┴───────────────── ┘
```

**Änderungen gegenüber UMBAU-PLAN:**
- Kamera Viewport neu (zweiter Viewport rechts, gleiche Szene, Final Look)
- Scene Explorer als Overlay oben links im 3D Viewport — kein eigenes Panel
- Play/Pause/Stop als Bottom-Overlay im 3D Viewport (nicht im Header)
- Alle Trennlinien verschiebbar via `react-resizable-panels`

**Neue Komponenten:**
- `ViewportPanel.tsx` — hält beide Views + R3F Canvas
- `EditorView.tsx` — 3D Viewport (OrbitControls, Grid, Gizmos)
- `CameraView.tsx` — Kamera Viewport (Final Look, kein Overlay)
- `SceneExplorer.tsx` — Overlay über EditorView, liest graph-store
- `Gizmos.tsx` — TransformControls (@react-three/drei)

---

## Phasen-Änderungen

**Phase 4 und 5 getauscht** gegenüber UMBAU-PLAN:
- Phase 4: Viewport Polish + Gizmos + Scene Explorer ← war Phase 5
- Phase 5: Custom Shaders + Texturen ← war Phase 4

**Begründung:** Gizmos und Scene Explorer sind UI-Infrastruktur die früh gebraucht wird. Custom Shaders sind ein Feature on top.

**Phase 4 — neue Inhalte:**
- Scene Explorer Overlay (oben links im 3D Viewport)
- Play/Pause/Stop als Bottom-Overlay im 3D Viewport (aus Header verschoben)
- Shading-Toggle: Shaded / Wireframe / Solid (oben rechts im 3D Viewport)
- Perspektiv-Toggle: Perspektiv / Orthogonal (Top, Front, Side)
- Kamera-Viewport: eigene Szenen-Kamera via Camera-Node

---

## Node-Roadmap (Ergänzung)

Nodes aus WVS-VISION.md die im UMBAU-PLAN fehlen, nach Priorität:

### Mittelfristig (Phase 4–5)
| Kategorie | Nodes |
|---|---|
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

## UI Style

**Referenz:** Zwischen Three.js Editor (zu hell) und Theatre.js (zu dunkel) — leicht warm, dunkel.

```css
:root {
  --bg-base:      oklch(45% 0.008 48); /* Haupt-Hintergrund — warm dunkelbraun */
  --bg-panel:     oklch(50% 0.008 48); /* Panel-Hintergrund (Node Graph, Props) */  
  --bg-elevated:  oklch(60% 0.008 48); /* Erhöhte Elemente (Cards, Dropdowns) */    
  --bg-viewport:  oklch(40% 0.008 48); /* 3D Viewport — noch etwas dunkler */      
  --border:       oklch(55% 0.008 48); /* Subtile Panel-Grenzen */             
  --text-primary: oklch(90% 0.010 48); /* Primärtext — warm off-white    */
  --text-muted:   oklch(80% 0.010 48); /* Labels, Metadaten               */            
  --accent:       oklch(70% 0.18  48); /* Leuchtendes Orange — Nodes, Ports, Focus */
}
```

**Prinzipien:**
- UI tritt zurück — 3D-Inhalt steht im Vordergrund
- Keine harten Kontraste zwischen Panels — fließende Hierarchie durch Helligkeit
- Blender-style Controls passen direkt ins Dark Theme
- OKLCH Design Tokens bleiben, werden mit dunkler Warm-Palette neu definiert
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

**Konvertierungsschicht:** `utils/color.ts` enthält bereits alle Konvertierungen (OKLCH, HSL, RGB, HEX) — wird bei jeder Farbwert-Übergabe an Three.js genutzt.

---

## Entschiedene Nicht-Ziele (v1)

- **Theatre.js** — UI-Stil-Konflikt, zu hoher Integrationsaufwand
- **Keyframe-Timeline** — zu komplex für v1; Loop-Animation via Time/Math-Nodes ist der Kern-Use-Case
- **Modelling** — kein Mesh-Editing, nur Szenen-Komposition
- **Three.js Editor Integration** — Vanilla JS, kein React, Aufwand nicht gerechtfertigt

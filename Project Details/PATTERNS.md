# Thr3ditor UI/UX Patterns

Dieses Dokument beschreibt die zentralen Interaktions- und Anzeigemuster des Editors.
Neue Features müssen konsistent mit diesen Patterns implementiert werden.

---

## Pattern A — Transform-Chain (Mesh + Path)

**Nodes:** Geometry/Mesh und Path

**Gizmo-Verhalten:**
- Drag im 3D Viewport → sucht existierenden Transform-Node passenden Modus im Graphen
- Falls keiner vorhanden: **Auto-erstellt einen Transform-Node** und fügt ihn in die Kette ein
- Auch ohne Downstream-Verbindung wird ein Transform-Node erstellt (hängt offen an der Node)
- Position/Rotation/Scale wird durch den Transform-Node gehalten — nie direkt auf der Source-Node

**Node-Ketten:**
```
[Geometry] → [Transform (Translate)] → [Transform (Rotate)] → [Scene Output]

[Path] → [Transform (Translate)] → [Transform (Rotate)] → [Camera / Light]
```

**Transform-Node Ports:**
- Hat sowohl `mesh` als auch `path` Input + Output — funktioniert in beiden Ketten
- Scale-Modus wird ausgeblendet wenn `path`-Port verbunden (Scale auf Paths sinnlos)

**Float-Port-Verbindung (Math/Time → x/y/z auf Transform-Node):**
- Slider in Properties → **Live-Anzeige** (accent-farbig, read-only)
- Wert erscheint neben dem Port im Node-Graph
- Implementierung: `linkedPort: 'x'` in der Transform-Node Property-Definition

---

## Pattern B — Path-Constraint (Camera + Light)

**Nodes:** Camera, Light (Directional + Point)

Camera und Light haben **keine eigene Position** — sie beziehen Position über eine Path-Kette.

**Verbindung:**
```
[Path] → [Transform (Translate/Rotate)] → [Camera / Light]
                                                ↑ path-Port
```

**Properties-Anzeige (Camera/Light bei verbundenem path-Port):**
- `linkedPath: true` auf Position X/Y/Z + Rotation X/Y/Z → werden zu **Live-Anzeigen**
- Position zeigt die reale Weltkoordinate der Node (Punkt auf dem Pfad)
- Rotation zeigt die akkumulierte Rotation aus Rotate-Transform-Nodes in der Kette
- Implementierung: `linkedPath: true` in PropertyDef, Cache-Keys `nodeId:positionX` etc. im LiveEvaluator

**Sichtbarkeit der Rotation-Props:**
- Camera (Free-Modus): Rotation X/Y/Z erscheint als Live-Anzeige wenn path verbunden
- Camera (Target-Modus): Rotation Props + Ports ausgeblendet
- Light (Directional, kein Target): Rotation X/Y/Z erscheint als Live-Anzeige wenn path verbunden
- Light (Directional + Target gesetzt): Rotation ausgeblendet (Target bestimmt Richtung)
- Light (Point): keine Rotation
- Light (Ambient): keine Rotation, keine Position, keine Path-Ports

---

## Pattern C — Float-Port Live-Anzeige

Immer wenn ein Float-Wert live aus einer verbundenen Node kommt:

1. **Properties Panel**: Slider → accent-farbige Read-only Box mit Wert
2. **Node-Graph**: Wert erscheint neben dem entsprechenden Input-Port

Gilt für: Transform x/y/z-Ports, Camera fov/pathProgress, Light intensity/distance etc.

Implementierung: `linkedPort: 'portName'` in PropertyDef.

---

## Port-Sichtbarkeit

Ports werden per `visibleWhen` auf der Port-Definition gesteuert — NodeRenderer filtert automatisch:

```typescript
// Port nur sichtbar wenn mode = 1 oder 2
{ name: 'positionX', type: 'float', visibleWhen: { uniform: 'mode', equal: [1, 2] } }
```

Verfügbare `VisibleWhenCondition`-Typen:
- `{ uniform: 'x', equal: n }` / `{ notEqual: n }` — Wert-Vergleich (number)
- `{ portDisconnected: 'portName' }` — zeigen wenn Port nicht verbunden
- `{ portConnected: 'portName' }` — zeigen wenn Port verbunden
- `{ uniformFalsy: 'x' }` — zeigen wenn Wert falsy (leer, 0, false)

---

## Pattern D — Scene Output: Szenen-weite Einstellungen

Der `scene/output`-Node ist der einzige Ort für **szenen-weite Render-Einstellungen**:

| Property | Typ | Beschreibung |
|---|---|---|
| `smoothShading` | bool | `flatShading = false` auf allen glTF-Materialien (default ON) |
| `bgColor` | color | Hintergrundfarbe im Camera Viewport |
| `envMap` | file (.hdr) | HDR Environment Map für IBL + Reflexionen |
| `envIntensity` | float | `scene.environmentIntensity` — live, kein Reload |
| `showEnvBackground` | bool | HDR als sichtbarer Hintergrund in beiden Viewports |

**Implementierung:** `EnvironmentLoader` Component in `SceneRenderer` — läuft in beiden Canvas-Instanzen (Editor + Camera) automatisch.

**Color-Properties:** immer als RGBA-Array `[r,g,b,a]` (0–1) in node defaults speichern — nie als Hex-String. Konvertierung zu Hex in `compiler.ts` via `rgbaToHex6()`.

---

## Pattern E — File Property Controls

`FileControl` — eine Zeile, konsistent mit Slider/Toggle:

```
[Label]
[ filename.ext oder placeholder    ] [ Open ]      ← single file (HDR etc.)
[ filename.glb oder placeholder    ] [ GLB ] [ Folder ]  ← glTF (detect via accept.includes('gltf'))
```

- `h-7`, `border-border-default`, `bg-surface-base` — wie alle anderen Controls
- Filename-Anzeige inline (read-only, truncated)
- Action-Buttons rechts mit `border-l border-border-default` Trennlinie
- `isGltf = param.accept?.includes('gltf')` → steuert ob Folder-Button erscheint

---

## Pattern I — Viewport Controls & Overlays

### Control-Bar Style
Alle Viewport-Overlay-Bars: `height: 26px`, semi-transparenter Hintergrund (`color-mix(in oklch, var(--color-surface-base) 85%, transparent)`), `border border-border-default`.

Buttons innerhalb der Bar: `px-2 h-full flex items-center text-xs font-medium transition-colors cursor-pointer`

**Aktiver Zustand** (Toggle-Buttons): inline `style={{ color: 'var(--color-accent)', background: 'color-mix(in oklch, var(--color-accent) 12%, transparent)' }}`  
**Inaktiver Zustand**: Tailwind-Klassen `text-text-muted hover:text-text-primary hover:bg-surface-panel` — KEIN inline `style` für Color, sonst blockiert es `hover:`.

**Minimize-Button im Max-Modus**: accent-Farbe + accent-Tinting — konsistent mit aktivem Toggle-Zustand.

### Viewport Maximize
CSS `absolute inset-0 z-10` Overlay — kein R3F-Remount, kein WebGL-Kontext-Verlust.  
`maximizedViewport: 'vp3d' | 'cam' | null` in EditorLayout.  
3D Viewport: Maximize/Minimize-Button via `extraButton`-Prop in `ViewportControlsOverlay` (bottom-right, gleiche Bar wie Shading/Projection).  
Camera Viewport: `ViewportMaximizeBtn` (standalone, `absolute bottom-3 right-3`). Max-Modus: `CamMaxOverlay`-Komponente mit eigenem ResizeObserver.

### Playbar Stacking
`PlaybackOverlay` hat `stacked`-Prop. Bei Viewport-Breite < 820px (`ResizeObserver` in `Viewport3D`/`CamMaxOverlay`):
- Normal: zentriert (`left-1/2 -translate-x-1/2 bottom-3`), Scrubber `w-40`
- Stacked: full-width (`left-3 right-3`, `bottom: 46px`), Scrubber `flex-1`

Controls-Bar bleibt immer `bottom-3 right-3`.

### Panel Collapse Buttons (`BorderCollapseBtn`)
- Sitzt **innerhalb des Panels** an der Border-Seite — NICHT in `PanelResizeHandle` (würde Drag-Interaktion stören)
- Graph Panel: `absolute top-0 left-1/2 -translate-x-1/2` — horizontale Pille (28×12px)
- Right Panel: `absolute left-0 top-1/2 -translate-y-1/2` — vertikale Pille (12×28px)
- Farbe: `bg-border-default hover:bg-accent` — verschmilzt visuell mit der Border
- Runde Ecken auf der Panel-Seite (weg von der Border): `.panel-collapse-btn-h` (unten), `.panel-collapse-btn-v` (rechts), `--radius-panel-btn` CSS-Variable
- `PanelHandle` mit `disabled={!open}` verhindert Resize im zugeklappten Zustand

---

## Anti-Patterns (nicht verwenden)

- ❌ Direkte positionX/Y/Z-Props auf Path-Nodes — Transform-Chain verwenden
- ❌ Sonderblöcke im PropertiesPanel für spezifische Node-Kombos — `linkedPath: true` verwenden
- ❌ Hardcodierte Plane-Dropdown (XY/XZ/YZ) — stattdessen rotationX/Y/Z via Transform verwenden
- ❌ Scale-Transform auf Path-Ketten — Scale ist nur für Mesh sinnvoll
- ❌ `computeVertexNormals()` für Smooth Shading — zerstört UV-Seams; nur `flatShading = false` verwenden
- ❌ Color-Defaults als Hex-String in NodeDefinition — RGBA-Array `[r,g,b,a]` verwenden
- ❌ OrbitControls top/bottom mit custom `camera.up` ([0,0,-1]) — swapped axes; epsilon-Offset + `up:[0,1,0]` verwenden
- ❌ `RectAreaLightHelper` aus three-stdlib für Area Light Visual — enthält unerwünschtes BackSide-Mesh, keinen Bogen; custom LineSegments + Line verwenden
- ❌ `EnvironmentLoader` `threeScene.background = null` unconditional — nur löschen wenn `showEnvBgRef.current` true; sonst überschreibt es die `<color>`-Komponente
- ❌ Same internal port `name` on both input and output side of the same node — ReactFlow handle collision; use unique names (`source` as input, `texture` as output)
- ❌ `alwaysHandle: true` ghost handle (0x0 invisible Handle) for always-present ports — causes edge misalignment because ReactFlow places the edge at the ghost handle's Y position, not the visible port
- ❌ `computeVertexNormals()` on tileable noise — destroys UV topology; just regenerate the CanvasTexture with new props
- ❌ Collapse-Button in `PanelResizeHandle` platzieren — konkurriert mit Drag; stattdessen ins Panel mit `absolute top-0`/`left-0`
- ❌ Inline `style={{ color }}` auf Toggle-Buttons im inaktiven Zustand — blockiert Tailwind `hover:text-*`; nur aktiver Zustand bekommt inline style
- ❌ `border-radius` via inline style oder Tailwind-Klasse — globales `* { border-radius: 0 !important }` überschreibt alles; CSS-Klasse mit eigenem `!important` verwenden

---

## Pattern G — Texture Node (Image / Noise / Normal)

The `texture` node uses a single node type with a `mode` property to switch between three sub-modes:

| Mode | Value | Inputs | Outputs |
|---|---|---|---|
| Image | 0 | — | `texture` (Texture →) |
| Noise | 1 | `scale`, `detail`, `roughness`, `resolution` (all float) | `texture` (Texture →) |
| Normal | 2 | `source` (→ Texture) | `texture` (Texture →) |

**Port naming convention:**
- Internal port `name` = the ReactFlow handle ID — must be **unique per node** (no same name on input AND output side)
- Port `label` = the display text shown to the user (can match other labels)
- Example: input port `name: 'source'`, `label: '→ Texture'` — NOT `name: 'texture'` (would collide with output `name: 'texture'`)

**visibleWhen + connection order:**
- Ports with `visibleWhen` only render their Handle when the condition is true
- User MUST set the correct mode before connecting a cable — the handle doesn't exist in DOM otherwise
- Normal mode: user sets mode=2, THEN connects a Noise/Image texture to the `source` port

**UV seam prevention:**
- All generated canvas textures: `wrapS = wrapT = THREE.RepeatWrapping`
- All loaded image textures: `wrapS = wrapT = THREE.RepeatWrapping`
- Noise canvas: use tileable lattice — `tileX = round(scale)`, sample at `(i/resolution)*tileX`
- fBm octaves: wrap lattice coordinates at `tileX*freq` per octave to maintain periodicity

**Known geometry limitations (UV seam gaps under displacement):**
- Cylinder / Capsule: cap UV (radial) and side UV (rectangular) are different UV islands at the same 3D vertex position → displacement gap at cap rim is unfixable with Three.js procedural geometry
- SphereGeometry poles: pole vertices have u=0..1 range at same 3D position → star artifact under displacement; use Icosphere instead
- Fix path: replace with Quad-Mesh primitives (Blender .glb, bundled as `src/assets/geometry/`)

---

## Pattern H — Node Consolidation (Modes)

When multiple nodes share the same conceptual domain, merge them into one node with a mode select:

| Before | After |
|--------|-------|
| shader/color + shader/mix + shader/gradient + shader/colorramp | shader/color (Mode: Color / Mix / Ramp) |
| math/add + math/multiply + ... | math (Mode: Add / Multiply / ...) |
| time (Linear only) + sin(time) | time (Mode: Linear / Sine / Sawtooth / Square / Bounce / Ease In / Ease Out / Ease In-Out) |

**Rules:**
- Use a select uniform named `colorMode`/`op` — NOT `mode` unless the label should completely replace the node title (geometry pattern)
- If uniform ≠ `mode`, NodeRenderer appends option label → "Shader Color: Mix"
- `appendToHeader: true` on a select property → appends the active option to the node title instead of replacing it: "Time: Sine" instead of just "Sine"
- `visibleWhen: { uniform: 'colorMode', equal: N }` on all mode-specific ports and properties
- Old node types: set `hidden: true` in NodeDefinition — keep compiler cases for backward compat
- Multi-output nodes (e.g. Color + Value + Alpha): use `portVar` map in compiler keyed by `"nodeId:portHandle"`, and update `resolvedInput`/`vResolve` to check portVar first

---

## Pattern J — Shader Graph Mouse Interaction

**Use case:** Per-element mouse effects in a shader (e.g. Dot Matrix where each dot reacts individually to the cursor).

**Node graph wiring:**
```
[Shader Mouse] ──mouse──▶ [Shader Pattern: Dots]
                              mouseEffect: Attract / Repel / Grow / Shrink
                              mouseRadius: 0.2   (influence area)
                              mouseStrength: 0.5 (max displacement / size change)
```

**`uMouse` coordinate system:**
- Three.js pointer (NDC [-1,1]) → `mouse.x * 0.5 + 0.5, mouse.y * 0.5 + 0.5` → UV [0,1]
- `uMouse.y = 1` at top, `0` at bottom — matches `vUv.y` for flat plane / screen effects

**Pixel-correct circular radius (critical):**
```glsl
// WRONG — creates vertical ellipse on wide viewports:
float dist = length(vec2(mVec.x, mVec.y * uAspect));

// CORRECT — 1 mouseRadius unit = fraction of viewport height:
float dist = length(vec2(mVec.x * uAspect, mVec.y));
```

**Per-dot center computation (Grid layout example):**
```glsl
// Expand fract() into floor+sub to expose the cell index
vec2 cellIdx  = floor(coord * vec2(scale, scaleY) + timeShift);
vec2 cell     = coord * vec2(scale, scaleY) + timeShift - cellIdx - 0.5;
vec2 dotCtrUV = (cellIdx + 0.5 - timeShift) / vec2(scale, scaleY);
vec2 mVec     = uMouse - dotCtrUV;
```

**Displacement direction (pixel-correct, Attract/Repel):**
```glsl
vec2 mPx  = vec2(mVec.x * uAspect, mVec.y);   // pixel-proportional space
vec2 mDir = normalize(mPx + vec2(0.00001, 0.0));
// Attract: cell -= mInfl * strength * mDir * 0.45  (max 0.45 cells = half a cell)
// Repel:   cell += mInfl * strength * mDir * 0.45
```

**Layout-specific direction handling:**
- **Grid / Hex:** use `mDir` directly (axis-aligned cell space matches pixel space)
- **Diagonal (45°-rotated grid):** rotate `mPx` by 45° before normalizing: `normalize(R45 * mPx)`, where `R45 = [[0.7071, -0.7071], [0.7071, 0.7071]]`

**Property visibility pattern:**
```typescript
// Effect selector — only visible when mouse port is connected
{ visibleWhen: [{ portConnected: 'mouse' }, { uniform: 'mode', equal: [0] }] }
// Radius + Strength — only when effect != None
{ visibleWhen: [..., { uniform: 'mouseEffect', notEqual: 0 }] }
```

**Anti-pattern:**
- ❌ Scaling displacement by `mouseRadius * scale` — produces 2+ cell displacement at defaults; use fixed constant (0.45 cells) instead
- ❌ `normalize(mVec)` in UV space for Diagonal — wrong direction; always normalize in pixel-proportional space first, then rotate into cell space

---

## Pattern F — Area Light

`RectAreaLight` benötigt `RectAreaLightUniformsLib.init()` einmalig am Module-Level.

**Editor-Visual (imperativ, kein JSX-Mesh):**
```
Rect-Outline (LineSegments):  4 Kanten + 2 Diagonalen (X-Muster)
Richtungslinie (Line):        (0,0,0) → (0,0,-0.6), feste Länge
Farbe:                        #ffdd44 / #ff8800 (selected) — per useFrame
depthTest: false, renderOrder: 999
```

**Target-Support:** `targetNodeId` NodeRef → `Matrix4.lookAt` Orientierung in `useFrame`. Rotation-Props/Ports mit `visibleWhen: [{ uniform: 'mode', equal: 3 }, { uniformFalsy: 'targetNodeId' }]` ausgeblendet wenn Target gesetzt.

**Einschränkungen:** Kein Shadow-Casting. Wirkt nur auf `MeshStandardMaterial` / `MeshPhysicalMaterial`.

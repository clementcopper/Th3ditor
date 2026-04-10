# WVS UI/UX Patterns

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

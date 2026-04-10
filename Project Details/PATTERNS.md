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

## Anti-Patterns (nicht verwenden)

- ❌ Direkte positionX/Y/Z-Props auf Path-Nodes — Transform-Chain verwenden
- ❌ Sonderblöcke im PropertiesPanel für spezifische Node-Kombos — `linkedPath: true` verwenden
- ❌ Hardcodierte Plane-Dropdown (XY/XZ/YZ) — stattdessen rotationX/Y/Z via Transform verwenden
- ❌ Scale-Transform auf Path-Ketten — Scale ist nur für Mesh sinnvoll

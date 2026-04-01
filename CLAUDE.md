# Shadertool — Project Context

## Overview
Universal web-based shader editor/previewer for Designdone. Built by Daniel Martin (DMA).

## Tech Stack
- React + TypeScript + Vite + Zustand (state) + Tailwind CSS
- Dual renderer: WebGPU (WGSL) primary, WebGL2 (GLSL) fallback
- `vite-plugin-glsl` for shader imports with `#include` (works for .glsl and .wgsl)
- `@webgpu/types` in tsconfig for TypeScript WebGPU support

## Architecture

### Renderer
- `IShaderRenderer` interface → `WebGPURenderer` + `ShaderRenderer` (WebGL2)
- `createRenderer()` factory — tries WebGPU first, falls back to WebGL2
- `ShaderCanvas.tsx` — async renderer init with `ready` state gate, `disposed` flag for race conditions
- WebGPU uniform buffers: Builtins struct (64 bytes: time, resolution, mouse, frame) + CustomUniforms struct (512 bytes)
- WebGPU pipelines are immutable — recreated on each `loadShader()`

### Shaders
- Each preset has BOTH `.frag` (GLSL) and `.wgsl` files — **always keep in sync**
- Common libraries in `src/shaders/common/` (noise, voronoi, OKLCH color, math utils)
- WebGPU `frag_coord.y` is top-down → all WGSL shaders flip: `vec2<f32>(frag_coord.x, resolution.y - frag_coord.y)`
- Mouse Y stays inverted (`1.0 - y`) in both renderers to match flipped UV convention

### Presets
1. **Mesh Gradient** — multi-blob noise gradient, OKLCH color mixing, grain
2. **Organic Blob** — SDF blob, smooth-min, OKLCH blending
3. **Aurora** — ribbon-based aurora borealis
4. **Dot Matrix** — 8 modulations, 3 dot shapes (circle/square/diamond), 4 interactions (Attractor/Repel/Magnet/Spotlight), rotation, spacing, frequency, highlight color
5. **Point Cloud 3D** — 3D point/line renderer, 9 deformations (None/Wave/Terrain/Twist/Ripple/Pinch/Explode/Pulse/Breathe), perspective projection, Points/Lines render mode, Segments control

### UI Patterns
- Blender-style drag-to-scrub input fields (no separate slider track), 3px accent line
- Toggle buttons for dropdowns with ≤3 options
- Rotation parameters in degrees with ° suffix
- `visibleWhen` for conditional parameter visibility
- `suffix` field on ParameterDef for unit display

### Export Pipeline
- **HTML**: WebGPU + WebGL2 dual-path when WGSL available
- **React**: Dual-path .tsx component with props
- **GLSL/WGSL**: Raw shader source + JSON manifest
- **Video**: OffscreenCanvas worker for jank-free recording, MediaRecorder fallback

### Rust/WASM (optional, not compiled)
- Crate at `crates/shadertool-wasm/` — naga WGSL validation + CPU noise precompute
- TypeScript wrapper at `src/wasm/shadertool-wasm.ts` with lazy-loading (`@vite-ignore`)
- Build: `cd crates/shadertool-wasm && wasm-pack build --target web --out-dir ../../src/wasm/pkg`
- Requires Rust + wasm-pack (not installed on Daniel's Mac as of 2026-03-31)

## WGSL Pitfalls (learned from bugs)
1. No function overloading — use `_v2`/`_v3` suffixes
2. `atan2(y, x)` instead of `atan(y, x)`
3. `%` operator instead of `mod()` for floats
4. `pow()` only for positive values — use cbrt helper
5. vec3 padded to vec4 (16 bytes) in uniform buffers
6. `frag_coord.y` is top-down — MUST flip in every WGSL shader
7. `snoise()` only accepts `vec2` — use `.xz` swizzle for 3D positions
8. No global mutable variables in fragment shaders — pass as function params
9. Explicit `f32` types: `vec4<f32>`, `vec2<f32>`, etc.

## Workflow Notes
- Daniel communicates in German, tests live in browser, reports visual bugs
- Keep responses concise — fix first, explain briefly
- Default renderQuality: `ultra-low`, default isPlaying: `false`
- Dev server: `npm run dev` / Build: `npm run build`

## Current Status (2026-03-31)
- Migration phases M1-M5 complete
- Point Cloud 3D: Lines render mode just added (Points/Lines toggle + Segments slider)
- GLSL shader was rewritten to fix global variable issue — needs browser testing
- Dot Matrix Magnet interaction: offset capped to prevent cell-edge clipping
- Performance goal: improve shader FPS on weak GPUs — main opportunity is noise texture precompute via compute shader (exists in `src/shaders/compute/noise-texture.wgsl` but NOT yet wired into render pipeline)

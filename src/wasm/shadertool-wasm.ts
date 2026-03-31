/**
 * TypeScript wrapper for the shadertool-wasm Rust/WASM module.
 *
 * Lazy-loads the WASM binary on first use. Falls back gracefully
 * if the WASM module is not built or not available.
 *
 * Build the WASM module:
 *   cd crates/shadertool-wasm
 *   wasm-pack build --target web --out-dir ../../src/wasm/pkg
 */

export interface WgslValidationResult {
  valid: boolean
  errors: WgslValidationError[]
}

export interface WgslValidationError {
  message: string
  line: number | null
  column: number | null
  severity: 'error' | 'warning'
}

interface ShadertoolWasm {
  validate_wgsl(source: string): WgslValidationResult
  generate_noise_texture(
    width: number,
    height: number,
    scale: number,
    offsetX: number,
    offsetY: number,
  ): Float32Array
}

let wasmModule: ShadertoolWasm | null = null
let loadAttempted = false
let loadPromise: Promise<ShadertoolWasm | null> | null = null

/**
 * Attempt to load the WASM module. Returns null if not available.
 * Safe to call multiple times — will only attempt loading once.
 */
async function loadWasm(): Promise<ShadertoolWasm | null> {
  if (wasmModule) return wasmModule
  if (loadAttempted) return null
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    loadAttempted = true
    try {
      // Dynamic import via string concatenation to prevent Vite from
      // statically analyzing and bundling this — it only exists after
      // `wasm-pack build` has been run.
      const wasmPath = './pkg/shadertool_wasm.js'
      const wasm = await import(/* @vite-ignore */ wasmPath)
      await wasm.default()  // Initialize the WASM module
      wasmModule = wasm as unknown as ShadertoolWasm
      console.log('shadertool-wasm loaded successfully')
      return wasmModule
    } catch {
      // WASM not available — this is expected if Rust hasn't been compiled
      console.debug('shadertool-wasm not available, using JS fallbacks')
      return null
    }
  })()

  return loadPromise
}

/**
 * Validate a WGSL shader source using naga (via WASM).
 * Returns null if WASM is not available (caller should skip validation).
 */
export async function validateWgsl(source: string): Promise<WgslValidationResult | null> {
  const wasm = await loadWasm()
  if (!wasm) return null
  return wasm.validate_wgsl(source)
}

/**
 * Generate a noise texture on the CPU using WASM (Rust simplex noise).
 * Returns null if WASM is not available.
 *
 * Output: Float32Array of RGBA values (width * height * 4 floats)
 *   R = snoise at base frequency
 *   G = fbm (4 octaves)
 *   B = snoise at 2x frequency
 *   A = 1.0
 */
export async function generateNoiseTexture(
  width: number,
  height: number,
  scale: number,
  offsetX: number,
  offsetY: number,
): Promise<Float32Array | null> {
  const wasm = await loadWasm()
  if (!wasm) return null
  return wasm.generate_noise_texture(width, height, scale, offsetX, offsetY)
}

/**
 * Check if the WASM module is loaded and ready.
 */
export function isWasmAvailable(): boolean {
  return wasmModule !== null
}

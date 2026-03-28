// ── Fundamental types ──────────────────────────────────────────────
export type RGBA = [number, number, number, number] // 0-1 each
export type ColorSpace = 'hex' | 'rgb' | 'hsl' | 'oklch'

// ── RGB ↔ HEX ──────────────────────────────────────────────────────
export function rgbaToHex8(c: RGBA): string {
  const [r, g, b, a] = c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255))
  const hex = [r, g, b, a].map((v) => v.toString(16).padStart(2, '0')).join('')
  return `#${hex}`
}

export function rgbaToHex6(c: RGBA): string {
  return rgbaToHex8(c).slice(0, 7)
}

export function hexToRgba(hex: string): RGBA {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2) || '0', 16) / 255
  const g = parseInt(h.slice(2, 4) || '0', 16) / 255
  const b = parseInt(h.slice(4, 6) || '0', 16) / 255
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
  return [r, g, b, a]
}

// ── RGB ↔ HSL ──────────────────────────────────────────────────────
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s * 100, l * 100]
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360
  s /= 100
  l /= 100
  if (s === 0) return [l, l, l]
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)]
}

// ── RGB ↔ Oklab ─────────────────────────────────────────────────────
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)

  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ]
}

export function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3

  return [
    clamp01(linearToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp01(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp01(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)),
  ]
}

// ── RGB ↔ OKLCH ─────────────────────────────────────────────────────
export function rgbToOklch(r: number, g: number, b: number): [number, number, number] {
  const [L, a, bVal] = rgbToOklab(r, g, b)
  const C = Math.sqrt(a * a + bVal * bVal)
  let H = (Math.atan2(bVal, a) * 180) / Math.PI
  if (H < 0) H += 360
  return [L, C, H]
}

export function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
  const hRad = (H * Math.PI) / 180
  return oklabToRgb(L, C * Math.cos(hRad), C * Math.sin(hRad))
}

// ── Formatting for display ──────────────────────────────────────────
export interface ColorFields {
  labels: string[]
  values: number[]
  ranges: [number, number][] // [min, max]
  steps: number[]
}

export function rgbaToColorFields(c: RGBA, space: ColorSpace): ColorFields {
  const alpha = c[3]
  switch (space) {
    case 'hex':
      return { labels: ['HEX', 'A'], values: [0, Math.round(alpha * 100)], ranges: [[0, 0], [0, 100]], steps: [0, 1] }
    case 'rgb':
      return {
        labels: ['R', 'G', 'B', 'A'],
        values: [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255), Math.round(alpha * 100)],
        ranges: [[0, 255], [0, 255], [0, 255], [0, 100]],
        steps: [1, 1, 1, 1],
      }
    case 'hsl': {
      const [h, s, l] = rgbToHsl(c[0], c[1], c[2])
      return {
        labels: ['H', 'S', 'L', 'A'],
        values: [Math.round(h), Math.round(s), Math.round(l), Math.round(alpha * 100)],
        ranges: [[0, 360], [0, 100], [0, 100], [0, 100]],
        steps: [1, 1, 1, 1],
      }
    }
    case 'oklch': {
      const [L, C, H] = rgbToOklch(c[0], c[1], c[2])
      return {
        labels: ['L', 'C', 'H', 'A'],
        values: [round3(L * 100), round3(C * 100), Math.round(H), Math.round(alpha * 100)],
        ranges: [[0, 100], [0, 40], [0, 360], [0, 100]],
        steps: [0.1, 0.1, 1, 1],
      }
    }
  }
}

export function colorFieldsToRgba(values: number[], space: ColorSpace, hexValue?: string): RGBA {
  switch (space) {
    case 'hex': {
      const rgba = hexToRgba(hexValue ?? '#000000')
      rgba[3] = values[1] / 100
      return rgba
    }
    case 'rgb':
      return [values[0] / 255, values[1] / 255, values[2] / 255, values[3] / 100]
    case 'hsl': {
      const [r, g, b] = hslToRgb(values[0], values[1], values[2])
      return [r, g, b, values[3] / 100]
    }
    case 'oklch': {
      const [r, g, b] = oklchToRgb(values[0] / 100, values[1] / 100, values[2])
      return [r, g, b, values[3] / 100]
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function round3(v: number): number {
  return Math.round(v * 10) / 10
}

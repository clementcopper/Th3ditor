import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { ShaderPreset } from '../engine/types'

interface ShareData {
  presetId: string
  parameters: Record<string, unknown>
}

export function encodeShareURL(preset: ShaderPreset, parameters: Record<string, unknown>): string {
  const data: ShareData = { presetId: preset.id, parameters }
  const json = JSON.stringify(data)
  const compressed = compressToEncodedURIComponent(json)
  return `${window.location.origin}${window.location.pathname}#s=${compressed}`
}

export function decodeShareURL(hash: string): ShareData | null {
  if (!hash.startsWith('#s=')) return null
  const compressed = hash.slice(3)
  const json = decompressFromEncodedURIComponent(compressed)
  if (!json) return null
  try {
    return JSON.parse(json) as ShareData
  } catch {
    return null
  }
}

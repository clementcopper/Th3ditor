export type PropertyType = 'float' | 'int' | 'bool' | 'color' | 'vec2' | 'vec3' | 'select' | 'gradient' | 'text' | 'curve'

export interface PropertyDef {
  type: PropertyType
  uniform: string
  label: string
  group?: string
  min?: number
  max?: number
  step?: number
  default: number | boolean | [number, number] | [number, number, number] | [number, number, number, number] | string | string[]
  options?: { label: string; value: string }[]
  suffix?: string
  visibleWhen?: { uniform: string; notEqual: number }
}

export type PropertyType = 'float' | 'int' | 'bool' | 'color' | 'vec2' | 'vec3' | 'select' | 'gradient' | 'text' | 'curve' | 'noderef'

export interface PropertyDef {
  type: PropertyType
  uniform: string
  label: string
  group?: string
  min?: number
  max?: number
  step?: number
  hardMin?: number
  hardMax?: number
  default: number | boolean | [number, number] | [number, number, number] | [number, number, number, number] | string | string[]
  options?: { label: string; value: string }[]
  /** For type='noderef': which node categories to list in the dropdown */
  categories?: string[]
  suffix?: string
  linkedPort?: string
  visibleWhen?: VisibleWhenCondition | VisibleWhenCondition[]
}

export type VisibleWhenCondition = { uniform: string; equal?: number | number[]; notEqual?: number }


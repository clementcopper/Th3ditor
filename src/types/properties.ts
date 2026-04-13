export type PropertyType = 'float' | 'int' | 'bool' | 'color' | 'vec2' | 'vec3' | 'select' | 'gradient' | 'text' | 'textarea' | 'curve' | 'noderef' | 'file' | 'colorramp'

export interface ColorRampStop {
  pos: number
  color: [number, number, number, number]
}

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
  default: number | boolean | [number, number] | [number, number, number] | [number, number, number, number] | string | string[] | ColorRampStop[]
  options?: { label: string; value: string; visibleWhenPortDisconnected?: string }[]
  /** For type='noderef': which node categories to list in the dropdown */
  categories?: string[]
  /** For type='file': accepted file extensions, e.g. '.gltf,.glb' */
  accept?: string
  suffix?: string
  linkedPort?: string
  /** When true: if a 'path' port is connected, show this property as a live read-only display
   *  sourced from the evaluator cache (keyed by own node id). */
  linkedPath?: boolean
  visibleWhen?: VisibleWhenCondition | VisibleWhenCondition[]
  /** For type='color': render the picker inline (always open) instead of as a dropdown */
  inline?: boolean
  /** Prevent this select property from being used as the node header fallback label */
  noHeader?: boolean
}

export type VisibleWhenCondition =
  | { uniform: string; equal?: number | number[]; notEqual?: number }
  | { portDisconnected: string }
  | { portConnected: string }
  | { uniformFalsy: string }  // visible when the named uniform is falsy (empty string, 0, false, undefined)


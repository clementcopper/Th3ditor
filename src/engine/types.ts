export type ParameterType = 'float' | 'int' | 'bool' | 'color' | 'vec2' | 'vec3' | 'select' | 'gradient'

export interface ParameterDef {
  type: ParameterType
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

export interface GradientStop {
  color: [number, number, number]
  position: number
}

export interface ShaderPreset {
  id: string
  name: string
  description: string
  category: 'gradient' | 'noise' | 'geometric' | 'organic' | 'atmospheric' | 'abstract' | 'pointcloud'
  fragmentShader: string
  parameters: ParameterDef[]
}

export type UniformValue =
  | number
  | boolean
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]

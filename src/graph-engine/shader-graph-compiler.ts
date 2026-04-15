import type { GraphNode, GraphEdge } from '../types/node-graph'
import type { ColorRampStop } from '../types/properties'
import { getNodeDef } from './node-registry'

export interface CompiledShaderGraph {
  fragmentShader: string
  /** Full custom vertex shader — unlit mode (shader/output → mesh directly) */
  vertexShader?: string
  /** PBR injection: prepend to Three.js vertex shader in onBeforeCompile */
  vertexPreamble?: string
  /** PBR injection: inject after #include <displacementmap_vertex> in onBeforeCompile */
  vertexBodyForPBR?: string
  uniforms: Record<string, { value: number | [number, number] | [number, number, number] | [number, number, number, number] }>
  uniformNodeMap: Record<string, string>  // "nodeId:propName" → uniformKey
  /** CPU float nodes wired to sfloat inputs: uniformKey → "sourceNodeId:sourceHandle" */
  bridgeUniforms: Record<string, string>
}

const SHADER_NODE_TYPES = new Set([
  'shader/uv', 'shader/time', 'shader/mouse', 'shader/position',
  'shader/noise', 'shader/gradient', 'shader/mix', 'shader/math',
  'shader/color', 'shader/number', 'shader/band', 'shader/component', 'shader/colorramp', 'shader/domainwarp',
  'shader/output',
])

// Output GLSL type per node type (undefined for terminals like shader/output)
const NODE_OUTPUT_GLSL_TYPE: Record<string, string> = {
  'shader/uv':         'vec2',
  'shader/time':       'float',
  'shader/mouse':      'vec2',
  'shader/position':   'vec3',
  'shader/noise':      'float',
  'shader/gradient':   'vec3',
  'shader/mix':        'vec3',
  'shader/math':       'float',
  'shader/color':      'vec3',
  'shader/number':     'float',
  'shader/band':       'float',
  'shader/component':  'float',
  'shader/colorramp':  'vec3',
  'shader/domainwarp': 'vec3',
}

const NOISE_PREAMBLE = `
// --- Shader Graph Noise Library ---
// 2D helpers
vec3 _sg_mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec2 _sg_mod289v2(vec2 x){return x-floor(x*(1./289.))*289.;}
vec4 _sg_mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec3 _sg_permute(vec3 x){return _sg_mod289(((x*34.)+10.)*x);}
vec4 _sg_permute4(vec4 x){return _sg_mod289v4(((x*34.)+10.)*x);}
vec4 _sg_taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}

// 3D Simplex Noise (Ashima Arts)
float _sg_snoise3(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=_sg_mod289(i);
  vec4 p=_sg_permute4(_sg_permute4(_sg_permute4(
    i.z+vec4(0.,i1.z,i2.z,1.))+
    i.y+vec4(0.,i1.y,i2.y,1.))+
    i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 xx=x_*ns.x+ns.yyyy;
  vec4 yy=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(xx)-abs(yy);
  vec4 b0=vec4(xx.xy,yy.xy);
  vec4 b1=vec4(xx.zw,yy.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=_sg_taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
// 3D fBm — XY = space, Z = time
float _sg_fbm3(vec3 p,int oct){
  float v=0.,a=.5;
  for(int i=0;i<8;i++){if(i>=oct)break; v+=a*_sg_snoise3(p); p*=2.; a*=.5;}
  return v*.5+.5;
}
float _sg_ridged3(vec3 p,int oct){
  float v=0.,a=.5;
  for(int i=0;i<8;i++){if(i>=oct)break; v+=a*(1.-abs(_sg_snoise3(p))); p*=2.; a*=.5;}
  return clamp(v,0.,1.);
}
// True 3D Voronoi (F1) — works seamlessly on any 3D surface
float _sg_voronoi3(vec3 p){
  vec3 ip=floor(p),fp=fract(p); float d=8.;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec3 nb=vec3(float(x),float(y),float(z));
    vec3 rnd=fract(sin(vec3(
      dot(ip+nb,vec3(127.1,311.7,74.7)),
      dot(ip+nb,vec3(269.5,183.3,246.1)),
      dot(ip+nb,vec3(113.5,271.9,124.6))
    ))*43758.5453);
    vec3 diff=nb+rnd-fp;
    d=min(d,dot(diff,diff));
  }
  return clamp(sqrt(d),0.,1.);
}
// Worley (F2-F1) — cell wall/edge pattern, distinct from Voronoi F1
float _sg_worley3(vec3 p){
  vec3 ip=floor(p),fp=fract(p); float d1=8.,d2=8.;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec3 nb=vec3(float(x),float(y),float(z));
    vec3 rnd=fract(sin(vec3(
      dot(ip+nb,vec3(127.1,311.7,74.7)),
      dot(ip+nb,vec3(269.5,183.3,246.1)),
      dot(ip+nb,vec3(113.5,271.9,124.6))
    ))*43758.5453);
    float d=dot(nb+rnd-fp,nb+rnd-fp);
    if(d<d1){d2=d1;d1=d;}else if(d<d2){d2=d;}
  }
  return clamp(sqrt(d2)-sqrt(d1),0.,1.);
}
// Curl noise (scalar) — 2D curl of fBm vector field → swirling flow patterns
float _sg_curl3(vec3 p,int oct){
  float h=0.1;
  float dFy_dx=(_sg_fbm3(p+vec3(h,0.,0.)+vec3(5.2,1.3,2.8),oct)-_sg_fbm3(p-vec3(h,0.,0.)+vec3(5.2,1.3,2.8),oct));
  float dFx_dy=(_sg_fbm3(p+vec3(0.,h,0.),oct)-_sg_fbm3(p-vec3(0.,h,0.),oct));
  return clamp((dFy_dx-dFx_dy)*0.5/(2.*h)+0.5,0.,1.);
}
`

// BFS backwards from outputNode through shader edges to collect all upstream shader nodes
function collectShaderNodes(
  outputNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): Set<string> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const visited = new Set<string>()
  const queue = [outputNodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const edge of edges) {
      if (edge.target === id) {
        const src = nodeMap.get(edge.source)
        if (src && SHADER_NODE_TYPES.has(src.type)) {
          queue.push(src.id)
        }
      }
    }
  }
  return visited
}

// Kahn's algorithm topological sort
function topoSort(nodeIds: string[], edges: GraphEdge[]): string[] {
  const idSet = new Set(nodeIds)
  const inDeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const id of nodeIds) {
    inDeg.set(id, 0)
    adj.set(id, [])
  }
  for (const edge of edges) {
    if (idSet.has(edge.source) && idSet.has(edge.target)) {
      adj.get(edge.source)!.push(edge.target)
      inDeg.set(edge.target, (inDeg.get(edge.target) ?? 0) + 1)
    }
  }
  const queue = nodeIds.filter((id) => (inDeg.get(id) ?? 0) === 0)
  const result: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    result.push(id)
    for (const next of adj.get(id) ?? []) {
      const deg = (inDeg.get(next) ?? 0) - 1
      inDeg.set(next, deg)
      if (deg === 0) queue.push(next)
    }
  }
  return result
}

function getNodeProps(node: GraphNode): Record<string, unknown> {
  const def = getNodeDef(node.type)
  return { ...(def?.defaults ?? {}), ...node.data }
}

// Extract a vec3 value from a color property [r,g,b,a] or [r,g,b]
function colorToVec3(val: unknown): [number, number, number] {
  if (Array.isArray(val) && val.length >= 3) {
    return [val[0] as number, val[1] as number, val[2] as number]
  }
  return [1, 1, 1]
}

// Format a float for GLSL (always has decimal point)
function fmtFloat(v: number): string {
  const s = v.toFixed(6).replace(/\.?0+$/, '')
  return s.includes('.') ? s : s + '.0'
}

// Format a vec3 for GLSL
function fmtVec3(v: [number, number, number]): string {
  return `vec3(${fmtFloat(v[0])},${fmtFloat(v[1])},${fmtFloat(v[2])})`
}

export function compileShaderGraph(
  outputNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): CompiledShaderGraph {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const shaderNodeIds = collectShaderNodes(outputNodeId, nodes, edges)
  const sorted = topoSort([...shaderNodeIds], edges)

  // Map nodeId → topo index
  const topoIdx = new Map<string, number>()
  sorted.forEach((id, i) => topoIdx.set(id, i))

  // Map nodeId → primary output variable name in GLSL
  const nodeVar = new Map<string, string>()
  // Per-output variables for multi-output nodes: "nodeId:portHandle" → varName
  const portVar = new Map<string, string>()

  // Accumulated shader sections
  const uniformDecls: string[] = [
    'uniform float uTime;',
    'uniform vec2 uMouse;',
    'uniform vec2 uResolution;',
    'varying vec2 vUv;',
    'varying vec3 vPosition;',
  ]
  const bodyLines: string[] = []
  const uniforms: Record<string, { value: number | [number, number] | [number, number, number] | [number, number, number, number] }> = {}
  const uniformNodeMap: Record<string, string> = {}
  const bridgeUniforms: Record<string, string> = {}  // uniformKey → "srcNodeId:srcHandle"
  let needsNoise = false

  // Helper: create a uniform for a float property
  function makeFloatUniform(node: GraphNode, propName: string, idx: number): string {
    const key = `_u${idx}_${propName}`
    const props = getNodeProps(node)
    const val = (props[propName] as number) ?? 0
    uniformDecls.push(`uniform float ${key};`)
    uniforms[key] = { value: val }
    uniformNodeMap[`${node.id}:${propName}`] = key
    return key
  }

  // Helper: create a uniform for a vec3 color property
  function makeVec3Uniform(node: GraphNode, propName: string, idx: number): string {
    const key = `_u${idx}_${propName}`
    const props = getNodeProps(node)
    const val = colorToVec3(props[propName])
    uniformDecls.push(`uniform vec3 ${key};`)
    uniforms[key] = { value: val }
    uniformNodeMap[`${node.id}:${propName}`] = key
    return key
  }

  // Helper: create a uniform for a vec4 color property (rgba)
  function makeVec4Uniform(node: GraphNode, propName: string, idx: number): string {
    const key = `_u${idx}_${propName}`
    const props = getNodeProps(node)
    const val = props[propName] as number[] ?? [1, 1, 1, 1]
    uniformDecls.push(`uniform vec4 ${key};`)
    uniforms[key] = { value: [val[0] ?? 1, val[1] ?? 1, val[2] ?? 1, val[3] ?? 1] as [number, number, number, number] }
    uniformNodeMap[`${node.id}:${propName}`] = key
    return key
  }

  // Helper: get resolved input expression (connected shader var, bridge uniform, or null)
  function resolvedInput(nodeId: string, portName: string): string | null {
    const edge = edges.find((e) => e.target === nodeId && e.targetHandle === portName)
    if (!edge) return null
    // Check per-port variable first (multi-output nodes like shader/color)
    const pk = `${edge.source}:${edge.sourceHandle}`
    if (portVar.has(pk)) return portVar.get(pk)!
    // Shader graph node — use its primary GLSL variable
    if (nodeVar.has(edge.source)) return nodeVar.get(edge.source)!
    // CPU float node — create a bridge uniform (evaluated at 60fps in useFrame)
    const srcNode = nodeMap.get(edge.source)
    if (srcNode) {
      const bridgeKey = `_br_${edge.source.replace(/[^a-zA-Z0-9]/g, '_')}`
      if (!bridgeUniforms[bridgeKey]) {
        uniformDecls.push(`uniform float ${bridgeKey};`)
        uniforms[bridgeKey] = { value: 0 }
        bridgeUniforms[bridgeKey] = `${edge.source}:${edge.sourceHandle}`
      }
      return bridgeKey
    }
    return null
  }

  for (const id of sorted) {
    const node = nodeMap.get(id)
    if (!node) continue
    const i = topoIdx.get(id) ?? 0
    const props = getNodeProps(node)
    const outVar = `_n${i}`

    switch (node.type) {
      case 'shader/uv': {
        bodyLines.push(`vec2 ${outVar} = vUv;`)
        nodeVar.set(id, outVar)
        break
      }

      case 'shader/mouse': {
        bodyLines.push(`vec2 ${outVar} = uMouse;`)
        nodeVar.set(id, outVar)
        break
      }

      case 'shader/position': {
        bodyLines.push(`vec3 ${outVar} = vPosition;`)
        nodeVar.set(id, outVar)
        break
      }

      case 'shader/time': {
        const speedU = makeFloatUniform(node, 'speed', i)
        bodyLines.push(`float ${outVar} = uTime * ${speedU};`)
        nodeVar.set(id, outVar)
        break
      }

      case 'shader/number': {
        const valU = makeFloatUniform(node, 'value', i)
        bodyLines.push(`float ${outVar} = ${valU};`)
        nodeVar.set(id, outVar)
        break
      }

      case 'shader/color': {
        const colorMode = Number(props.colorMode ?? 0)
        const cVar = `_n${i}_c`
        const vVar = `_n${i}_v`
        const aVar = `_n${i}_a`

        if (colorMode === 1) {
          // Mix
          const aIn = resolvedInput(id, 'colorA')
          const aExpr = aIn ?? makeVec3Uniform(node, 'colorA', i)
          const bIn = resolvedInput(id, 'colorB')
          const bExpr = bIn ?? makeVec3Uniform(node, 'colorB', i)
          const tIn = resolvedInput(id, 't')
          const tExpr = tIn ?? makeFloatUniform(node, 't', i)
          bodyLines.push(`vec3 ${cVar} = mix(${aExpr}, ${bExpr}, clamp(${tExpr}, 0.0, 1.0));`)
          bodyLines.push(`float ${vVar} = dot(${cVar}, vec3(0.2126, 0.7152, 0.0722));`)
          bodyLines.push(`float ${aVar} = 1.0;`)
        } else if (colorMode === 2) {
          // Ramp
          const tIn = resolvedInput(id, 't')
          const tExpr = tIn ?? makeFloatUniform(node, 't', i)
          const rawStops = props.stops as import('../types/properties').ColorRampStop[] | undefined
          const stops = (rawStops && rawStops.length >= 2 ? rawStops : [
            { pos: 0, color: [0, 0, 0, 1] as [number, number, number, number] },
            { pos: 1, color: [1, 1, 1, 1] as [number, number, number, number] },
          ]).slice().sort((a, b) => a.pos - b.pos)
          const posUniforms: string[] = []
          const colUniforms: string[] = []
          for (let j = 0; j < stops.length; j++) {
            const pk = `_u${i}_p${j}`
            uniformDecls.push(`uniform float ${pk};`)
            uniforms[pk] = { value: stops[j].pos }
            posUniforms.push(pk)
            const ck = `_u${i}_s${j}`
            uniformDecls.push(`uniform vec3 ${ck};`)
            uniforms[ck] = { value: [stops[j].color[0], stops[j].color[1], stops[j].color[2]] as [number, number, number] }
            uniformNodeMap[`${node.id}:stops[${j}].color`] = ck
            colUniforms.push(ck)
          }
          const tVar = `_ramp_t${i}`
          bodyLines.push(`float ${tVar} = clamp(${tExpr}, 0.0, 1.0);`)
          bodyLines.push(`vec3 ${cVar} = mix(${colUniforms[0]}, ${colUniforms[1]}, clamp((${tVar} - ${posUniforms[0]}) / max(${posUniforms[1]} - ${posUniforms[0]}, 0.0001), 0.0, 1.0));`)
          for (let j = 1; j < stops.length - 1; j++) {
            const nextVar = `_ramp_next${i}_${j}`
            bodyLines.push(`vec3 ${nextVar} = mix(${colUniforms[j]}, ${colUniforms[j + 1]}, clamp((${tVar} - ${posUniforms[j]}) / max(${posUniforms[j + 1]} - ${posUniforms[j]}, 0.0001), 0.0, 1.0));`)
            bodyLines.push(`${cVar} = mix(${cVar}, ${nextVar}, step(${posUniforms[j]}, ${tVar}));`)
          }
          bodyLines.push(`float ${vVar} = dot(${cVar}, vec3(0.2126, 0.7152, 0.0722));`)
          bodyLines.push(`float ${aVar} = 1.0;`)
        } else {
          // Mode 0: Constant color with optional per-channel overrides
          const colorU = makeVec4Uniform(node, 'color', i)
          const rIn = resolvedInput(id, 'r')
          const gIn = resolvedInput(id, 'g')
          const bIn = resolvedInput(id, 'b')
          const aIn = resolvedInput(id, 'a')
          const rExpr = rIn ?? `${colorU}.r`
          const gExpr = gIn ?? `${colorU}.g`
          const bExpr = bIn ?? `${colorU}.b`
          const aExpr = aIn ?? `${colorU}.a`
          bodyLines.push(`vec3 ${cVar} = vec3(${rExpr}, ${gExpr}, ${bExpr});`)
          bodyLines.push(`float ${vVar} = dot(${cVar}, vec3(0.2126, 0.7152, 0.0722));`)
          bodyLines.push(`float ${aVar} = ${aExpr};`)
        }

        portVar.set(`${id}:color`, cVar)
        portVar.set(`${id}:value`, vVar)
        portVar.set(`${id}:alpha`, aVar)
        nodeVar.set(id, cVar)
        break
      }

      case 'shader/noise': {
        needsNoise = true
        const scaleIn = resolvedInput(id, 'scale')
        const scaleExpr = scaleIn ?? makeFloatUniform(node, 'scale', i)
        const timeIn = resolvedInput(id, 'time')
        const timeExpr = timeIn ?? makeFloatUniform(node, 'timeSpeed', i)
        const seedIn = resolvedInput(id, 'seed')
        const seedExpr = seedIn ?? makeFloatUniform(node, 'seed', i)
        const detailU = makeFloatUniform(node, 'detail', i)
        const noiseType = Number(props.noiseType ?? 0)

        // Position port takes priority over UV — avoids UV seam on meshes
        const posIn = resolvedInput(id, 'position')
        let p3: string
        if (posIn) {
          // 3D object-space position: scale + seed offset + time for animation
          p3 = `${posIn} * ${scaleExpr} + vec3(${seedExpr}, ${seedExpr}, ${timeExpr})`
        } else {
          // UV mode: XY = scaled UV + seed, Z = time for morphing
          const uvIn = resolvedInput(id, 'uv') ?? 'vUv'
          p3 = `vec3(${uvIn} * ${scaleExpr} + vec2(${seedExpr}), ${timeExpr})`
        }

        let expr: string
        if (noiseType === 4) {
          expr = `_sg_curl3(${p3}, int(${detailU}))`
        } else if (noiseType === 3) {
          expr = `_sg_worley3(${p3})`
        } else if (noiseType === 2) {
          expr = `_sg_voronoi3(${p3})`
        } else if (noiseType === 1) {
          expr = `_sg_ridged3(${p3}, int(${detailU}))`
        } else {
          expr = `_sg_fbm3(${p3}, int(${detailU}))`
        }
        bodyLines.push(`float ${outVar} = ${expr};`)
        nodeVar.set(id, outVar)
        break
      }

      case 'shader/gradient': {
        const tIn = resolvedInput(id, 't')
        const tExpr = tIn ?? makeFloatUniform(node, 't', i)
        const colorAU = makeVec3Uniform(node, 'colorA', i)
        const colorBU = makeVec3Uniform(node, 'colorB', i)
        bodyLines.push(`vec3 ${outVar} = mix(${colorAU}, ${colorBU}, clamp(${tExpr}, 0.0, 1.0));`)
        nodeVar.set(id, outVar)
        break
      }

      case 'shader/mix': {
        const aIn = resolvedInput(id, 'a')
        const aExpr = aIn ?? makeVec3Uniform(node, 'a', i)
        const bIn = resolvedInput(id, 'b')
        const bExpr = bIn ?? makeVec3Uniform(node, 'b', i)
        const tIn = resolvedInput(id, 't')
        const tExpr = tIn ?? makeFloatUniform(node, 't', i)
        bodyLines.push(`vec3 ${outVar} = mix(${aExpr}, ${bExpr}, clamp(${tExpr}, 0.0, 1.0));`)
        nodeVar.set(id, outVar)
        break
      }

      case 'shader/math': {
        const op = Number(props.op ?? 0)
        if (op === 9) {  // Number — constant, no inputs
          const valU = makeFloatUniform(node, 'value', i)
          bodyLines.push(`float ${outVar} = ${valU};`)
          nodeVar.set(id, outVar)
          break
        }
        const aIn = resolvedInput(id, 'a')
        const aExpr = aIn ?? makeFloatUniform(node, 'a', i)
        let mathExpr: string
        if (op === 7) {  // Lerp
          const bIn = resolvedInput(id, 'b')
          const bExpr = bIn ?? makeFloatUniform(node, 'b', i)
          const tIn = resolvedInput(id, 't')
          const tExpr = tIn ?? makeFloatUniform(node, 'lerpT', i)
          mathExpr = `mix(${aExpr}, ${bExpr}, clamp(${tExpr}, 0.0, 1.0))`
        } else if (op <= 2) {  // Multiply(0), Add(1), Subtract(2)
          const bIn = resolvedInput(id, 'b')
          const bExpr = bIn ?? makeFloatUniform(node, 'b', i)
          switch (op) {
            case 1:  mathExpr = `${aExpr} + ${bExpr}`; break
            case 2:  mathExpr = `${aExpr} - ${bExpr}`; break
            default: mathExpr = `${aExpr} * ${bExpr}`; break
          }
        } else {
          switch (op) {
            case 4:  mathExpr = `cos(${aExpr})`; break
            case 5:  mathExpr = `abs(${aExpr})`; break
            case 6:  mathExpr = `clamp(${aExpr}, 0.0, 1.0)`; break
            case 8:  mathExpr = `fract(${aExpr})`; break
            default: mathExpr = `sin(${aExpr})`; break  // Sin
          }
        }
        bodyLines.push(`float ${outVar} = ${mathExpr};`)
        nodeVar.set(id, outVar)
        break
      }

      case 'shader/band': {
        const tIn = resolvedInput(id, 't')
        const tExpr = tIn ?? '0.0'
        const centerIn = resolvedInput(id, 'center')
        const centerExpr = centerIn ?? makeFloatUniform(node, 'center', i)
        const widthIn = resolvedInput(id, 'width')
        const widthExpr = widthIn ?? makeFloatUniform(node, 'width', i)
        const sharpU = makeFloatUniform(node, 'sharp', i)
        // smoothstep band: 1 at center, 0 outside width
        // sharpness 0 = fully soft (gradual), 1 = hard edge
        const dVar = `_band_d${i}`
        const halfW = `_band_hw${i}`
        const softW = `_band_sw${i}`
        bodyLines.push(`float ${dVar} = abs(${tExpr} - ${centerExpr});`)
        bodyLines.push(`float ${halfW} = max(${widthExpr} * 0.5, 0.0001);`)
        bodyLines.push(`float ${softW} = ${halfW} * (1.0 - ${sharpU});`)
        bodyLines.push(`float ${outVar} = 1.0 - smoothstep(${halfW} - ${softW}, ${halfW} + ${softW}, ${dVar});`)
        nodeVar.set(id, outVar)
        break
      }

      case 'shader/component': {
        const vecIn = resolvedInput(id, 'vec')
        const vecExpr = vecIn ?? 'vPosition'
        const comp = Number(props.component ?? 1)
        const swizzle = comp === 0 ? 'x' : comp === 2 ? 'z' : 'y'
        bodyLines.push(`float ${outVar} = ${vecExpr}.${swizzle};`)
        nodeVar.set(id, outVar)
        break
      }

      case 'shader/colorramp': {
        const tIn = resolvedInput(id, 't')
        const tExpr = tIn ?? makeFloatUniform(node, 't', i)
        const rawStops = props.stops as ColorRampStop[] | undefined
        const stops = (rawStops && rawStops.length >= 2 ? rawStops : [
          { pos: 0, color: [0, 0, 0, 1] as [number, number, number, number] },
          { pos: 1, color: [1, 1, 1, 1] as [number, number, number, number] },
        ]).slice().sort((a, b) => a.pos - b.pos)

        // Declare position + color uniforms for each stop
        const posUniforms: string[] = []
        const colUniforms: string[] = []
        for (let j = 0; j < stops.length; j++) {
          const pk = `_u${i}_p${j}`
          uniformDecls.push(`uniform float ${pk};`)
          uniforms[pk] = { value: stops[j].pos }
          posUniforms.push(pk)

          const ck = `_u${i}_s${j}`
          uniformDecls.push(`uniform vec3 ${ck};`)
          uniforms[ck] = { value: [stops[j].color[0], stops[j].color[1], stops[j].color[2]] as [number, number, number] }
          uniformNodeMap[`${node.id}:stops[${j}].color`] = ck
          colUniforms.push(ck)
        }

        // Generate GLSL mix chain
        const tVar = `_ramp_t${i}`
        bodyLines.push(`float ${tVar} = clamp(${tExpr}, 0.0, 1.0);`)
        // First segment
        bodyLines.push(`vec3 ${outVar} = mix(${colUniforms[0]}, ${colUniforms[1]}, clamp((${tVar} - ${posUniforms[0]}) / max(${posUniforms[1]} - ${posUniforms[0]}, 0.0001), 0.0, 1.0));`)
        // Subsequent segments
        for (let j = 1; j < stops.length - 1; j++) {
          const nextVar = `_ramp_next${i}_${j}`
          bodyLines.push(`vec3 ${nextVar} = mix(${colUniforms[j]}, ${colUniforms[j + 1]}, clamp((${tVar} - ${posUniforms[j]}) / max(${posUniforms[j + 1]} - ${posUniforms[j]}, 0.0001), 0.0, 1.0));`)
          bodyLines.push(`${outVar} = mix(${outVar}, ${nextVar}, step(${posUniforms[j]}, ${tVar}));`)
        }

        nodeVar.set(id, outVar)
        break
      }

      case 'shader/domainwarp': {
        needsNoise = true
        const posIn = resolvedInput(id, 'position')
        const posExpr = posIn ?? 'vPosition'
        const strengthIn = resolvedInput(id, 'strength')
        const strengthExpr = strengthIn ?? makeFloatUniform(node, 'strength', i)
        const timeIn = resolvedInput(id, 'time')
        const timeExpr = timeIn ?? `(uTime * ${makeFloatUniform(node, 'timeSpeed', i)})`
        const scaleU = makeFloatUniform(node, 'scale', i)
        const octavesU = makeFloatUniform(node, 'octaves', i)

        // Scale + animate the input position
        const pVar = `_dw_p${i}`
        bodyLines.push(`vec3 ${pVar} = ${posExpr} * ${scaleU} + vec3(0.0, 0.0, ${timeExpr});`)
        // Three fBm samples for x/y/z warp directions (Inigo Quilez offsets)
        const qxVar = `_dw_qx${i}`
        const qyVar = `_dw_qy${i}`
        const qzVar = `_dw_qz${i}`
        bodyLines.push(`float ${qxVar} = _sg_fbm3(${pVar} + vec3(0.0, 0.0, 0.0), int(${octavesU}));`)
        bodyLines.push(`float ${qyVar} = _sg_fbm3(${pVar} + vec3(5.2, 1.3, 2.8), int(${octavesU}));`)
        bodyLines.push(`float ${qzVar} = _sg_fbm3(${pVar} + vec3(3.7, 9.2, 8.1), int(${octavesU}));`)
        bodyLines.push(`vec3 ${outVar} = ${posExpr} + vec3(${qxVar}, ${qyVar}, ${qzVar}) * ${strengthExpr};`)
        nodeVar.set(id, outVar)
        break
      }

      case 'shader/output': {
        // Terminal node — generate gl_FragColor
        const colorIn = resolvedInput(id, 'color')
        const colorExpr = colorIn ?? makeVec3Uniform(node, 'defaultColor', i)
        const alphaIn = resolvedInput(id, 'alpha')
        const alphaExpr = alphaIn ?? makeFloatUniform(node, 'defaultAlpha', i)
        bodyLines.push(`gl_FragColor = vec4(${colorExpr}, ${alphaExpr});`)
        break
      }

      default:
        break
    }
  }

  // If no shader/output node found or gl_FragColor not set, add fallback
  const hasOutput = sorted.some((id) => nodeMap.get(id)?.type === 'shader/output')
  if (!hasOutput) {
    bodyLines.push('gl_FragColor = vec4(vUv, 0.5, 1.0);')
  }

  // Assemble final fragment shader
  const parts: string[] = []
  if (needsNoise) parts.push(NOISE_PREAMBLE)
  parts.push(uniformDecls.join('\n'))
  parts.push('\nvoid main() {')
  for (const line of bodyLines) {
    parts.push(`  ${line}`)
  }
  parts.push('}')

  const fragmentShader = parts.join('\n')

  // === Displacement vertex shader ===
  // Compile a custom vertex shader when the displacement input is connected.
  // Nodes are recompiled in "vertex context": shader/uv → uv attribute, shader/position → position attribute.
  let vertexShader: string | undefined
  let vertexPreamble: string | undefined
  let vertexBodyForPBR: string | undefined

  const dispEdge = edges.find((e) => e.target === outputNodeId && e.targetHandle === 'displacement')
  if (dispEdge) {
    // BFS to collect displacement chain nodes
    const dispChain = new Set<string>()
    const dq = [dispEdge.source]
    while (dq.length > 0) {
      const did = dq.shift()!
      if (dispChain.has(did)) continue
      dispChain.add(did)
      for (const e of edges) {
        if (e.target === did) {
          const src = nodeMap.get(e.source)
          if (src && SHADER_NODE_TYPES.has(src.type)) dq.push(src.id)
        }
      }
    }

    // Use same topo order as fragment pass (consistent variable names)
    const dispSorted = sorted.filter((id) => dispChain.has(id))
    const vBody: string[] = []      // inline body (position attribute)
    const vBodyFunc: string[] = []  // function body (_sg_p parameter — for finite differences)
    const vVar = new Map<string, string>()
    const vPortVar = new Map<string, string>()  // "nodeId:portHandle" → varName (multi-output)
    let positionNodeUsed = false

    function vResolve(nodeId: string, portName: string): string | null {
      const e = edges.find((e) => e.target === nodeId && e.targetHandle === portName)
      if (!e) return null
      // Check per-port variable first (multi-output nodes like shader/color)
      const pk = `${e.source}:${e.sourceHandle}`
      if (vPortVar.has(pk)) return vPortVar.get(pk)!
      if (vVar.has(e.source)) return vVar.get(e.source)!
      const bk = `_br_${e.source.replace(/[^a-zA-Z0-9]/g, '_')}`
      return uniforms[bk] ? bk : null
    }

    for (const id of dispSorted) {
      const node = nodeMap.get(id)
      if (!node) continue
      const i = topoIdx.get(id) ?? 0
      const props = getNodeProps(node)
      const v = `_n${i}`

      switch (node.type) {
        case 'shader/uv': {
          const line = `vec2 ${v} = uv;`
          vBody.push(line); vBodyFunc.push(line); vVar.set(id, v); break
        }
        case 'shader/position': {
          positionNodeUsed = true
          vBody.push(`vec3 ${v} = position;`)
          vBodyFunc.push(`vec3 ${v} = _sg_p;`)   // parameterised for finite differences
          vVar.set(id, v); break
        }
        case 'shader/mouse': {
          const line = `vec2 ${v} = uMouse;`
          vBody.push(line); vBodyFunc.push(line); vVar.set(id, v); break
        }
        case 'shader/time': {
          const line = `float ${v} = uTime * _u${i}_speed;`
          vBody.push(line); vBodyFunc.push(line); vVar.set(id, v); break
        }
        case 'shader/number': {
          const line = `float ${v} = _u${i}_value;`
          vBody.push(line); vBodyFunc.push(line); vVar.set(id, v); break
        }
        case 'shader/noise': {
          const scaleExpr = vResolve(id, 'scale') ?? `_u${i}_scale`
          const timeExpr  = vResolve(id, 'time')  ?? `_u${i}_timeSpeed`
          const seedExpr  = vResolve(id, 'seed')  ?? `_u${i}_seed`
          const detailU   = `_u${i}_detail`
          const noiseType = Number(props.noiseType ?? 0)
          const posIn = vResolve(id, 'position')
          const p3 = posIn
            ? `${posIn} * ${scaleExpr} + vec3(${seedExpr}, ${seedExpr}, ${timeExpr})`
            : `vec3(${vResolve(id, 'uv') ?? 'uv'} * ${scaleExpr} + vec2(${seedExpr}), ${timeExpr})`
          const expr = noiseType === 4 ? `_sg_curl3(${p3}, int(${detailU}))`
            : noiseType === 3 ? `_sg_worley3(${p3})`
            : noiseType === 2 ? `_sg_voronoi3(${p3})`
            : noiseType === 1 ? `_sg_ridged3(${p3}, int(${detailU}))`
            : `_sg_fbm3(${p3}, int(${detailU}))`
          const line = `float ${v} = ${expr};`
          vBody.push(line); vBodyFunc.push(line); vVar.set(id, v); break
        }
        case 'shader/math': {
          const op = Number(props.op ?? 0)
          if (op === 9) {  // Number — constant, no inputs
            const line = `float ${v} = _u${i}_value;`
            vBody.push(line); vBodyFunc.push(line); vVar.set(id, v); break
          }
          const aExpr = vResolve(id, 'a') ?? `_u${i}_a`
          let expr: string
          if (op === 7) {
            const bExpr = vResolve(id, 'b') ?? `_u${i}_b`
            const tExpr = vResolve(id, 't') ?? `_u${i}_lerpT`
            expr = `mix(${aExpr}, ${bExpr}, clamp(${tExpr}, 0.0, 1.0))`
          } else if (op <= 2) {
            const bExpr = vResolve(id, 'b') ?? `_u${i}_b`
            expr = op === 1 ? `${aExpr} + ${bExpr}` : op === 2 ? `${aExpr} - ${bExpr}` : `${aExpr} * ${bExpr}`
          } else {
            expr = op === 4 ? `cos(${aExpr})` : op === 5 ? `abs(${aExpr})` : op === 6 ? `clamp(${aExpr}, 0.0, 1.0)` : op === 8 ? `fract(${aExpr})` : `sin(${aExpr})`
          }
          const line = `float ${v} = ${expr};`
          vBody.push(line); vBodyFunc.push(line); vVar.set(id, v); break
        }
        case 'shader/band': {
          const tExpr = vResolve(id, 't') ?? '0.0'
          const centerExpr = vResolve(id, 'center') ?? `_u${i}_center`
          const widthExpr = vResolve(id, 'width') ?? `_u${i}_width`
          const sharpU = `_u${i}_sharp`
          const lines = [
            `float _band_d${i} = abs(${tExpr} - ${centerExpr});`,
            `float _band_hw${i} = max(${widthExpr} * 0.5, 0.0001);`,
            `float _band_sw${i} = _band_hw${i} * (1.0 - ${sharpU});`,
            `float ${v} = 1.0 - smoothstep(_band_hw${i} - _band_sw${i}, _band_hw${i} + _band_sw${i}, _band_d${i});`,
          ]
          for (const l of lines) { vBody.push(l); vBodyFunc.push(l) }
          vVar.set(id, v); break
        }
        case 'shader/component': {
          const vecIn = vResolve(id, 'vec')
          const vecExpr = vecIn ?? 'position'
          const comp = Number(props.component ?? 1)
          const swizzle = comp === 0 ? 'x' : comp === 2 ? 'z' : 'y'
          const line = `float ${v} = ${vecExpr}.${swizzle};`
          vBody.push(line); vBodyFunc.push(line); vVar.set(id, v); break
        }
        case 'shader/domainwarp': {
          const posIn = vResolve(id, 'position')
          const posExpr = posIn ?? 'position'
          const strengthExpr = vResolve(id, 'strength') ?? `_u${i}_strength`
          const timeExpr = vResolve(id, 'time') ?? `(uTime * _u${i}_timeSpeed)`
          const scaleU = `_u${i}_scale`
          const octavesU = `_u${i}_octaves`
          const lineP = `vec3 _dw_p${i} = ${posExpr} * ${scaleU} + vec3(0.0, 0.0, ${timeExpr});`
          const lineX = `float _dw_qx${i} = _sg_fbm3(_dw_p${i} + vec3(0.0, 0.0, 0.0), int(${octavesU}));`
          const lineY = `float _dw_qy${i} = _sg_fbm3(_dw_p${i} + vec3(5.2, 1.3, 2.8), int(${octavesU}));`
          const lineZ = `float _dw_qz${i} = _sg_fbm3(_dw_p${i} + vec3(3.7, 9.2, 8.1), int(${octavesU}));`
          const lineW = `vec3 ${v} = ${posExpr} + vec3(_dw_qx${i}, _dw_qy${i}, _dw_qz${i}) * ${strengthExpr};`
          for (const l of [lineP, lineX, lineY, lineZ, lineW]) {
            vBody.push(l); vBodyFunc.push(l)
          }
          vVar.set(id, v); break
        }
        case 'shader/color': {
          const colorMode = Number(props.colorMode ?? 0)
          const cVar = `_n${i}_c`
          const vVarName = `_n${i}_v`
          const aVar = `_n${i}_a`

          if (colorMode === 1) {
            const aIn = vResolve(id, 'colorA')
            const aExpr = aIn ?? `_u${i}_colorA`
            const bIn = vResolve(id, 'colorB')
            const bExpr = bIn ?? `_u${i}_colorB`
            const tIn = vResolve(id, 't')
            const tExpr = tIn ?? `_u${i}_t`
            const l1 = `vec3 ${cVar} = mix(${aExpr}, ${bExpr}, clamp(${tExpr}, 0.0, 1.0));`
            const l2 = `float ${vVarName} = dot(${cVar}, vec3(0.2126, 0.7152, 0.0722));`
            vBody.push(l1, l2); vBodyFunc.push(l1, l2)
          } else if (colorMode === 2) {
            const tIn = vResolve(id, 't')
            const tExpr = tIn ?? `_u${i}_t`
            // Build ramp using same uniforms declared in fragment pass
            const rawStops = props.stops as import('../types/properties').ColorRampStop[] | undefined
            const stops = (rawStops && rawStops.length >= 2 ? rawStops : [
              { pos: 0, color: [0, 0, 0, 1] as [number, number, number, number] },
              { pos: 1, color: [1, 1, 1, 1] as [number, number, number, number] },
            ]).slice().sort((a, b) => a.pos - b.pos)
            const posUniforms = stops.map((_, j) => `_u${i}_p${j}`)
            const colUniforms = stops.map((_, j) => `_u${i}_s${j}`)
            const tVar = `_ramp_t${i}`
            const lines: string[] = [
              `float ${tVar} = clamp(${tExpr}, 0.0, 1.0);`,
              `vec3 ${cVar} = mix(${colUniforms[0]}, ${colUniforms[1]}, clamp((${tVar} - ${posUniforms[0]}) / max(${posUniforms[1]} - ${posUniforms[0]}, 0.0001), 0.0, 1.0));`,
            ]
            for (let j = 1; j < stops.length - 1; j++) {
              const nextVar = `_ramp_next${i}_${j}`
              lines.push(`vec3 ${nextVar} = mix(${colUniforms[j]}, ${colUniforms[j + 1]}, clamp((${tVar} - ${posUniforms[j]}) / max(${posUniforms[j + 1]} - ${posUniforms[j]}, 0.0001), 0.0, 1.0));`)
              lines.push(`${cVar} = mix(${cVar}, ${nextVar}, step(${posUniforms[j]}, ${tVar}));`)
            }
            lines.push(`float ${vVarName} = dot(${cVar}, vec3(0.2126, 0.7152, 0.0722));`)
            for (const l of lines) { vBody.push(l); vBodyFunc.push(l) }
          } else {
            // Mode 0: constant color
            const colorU = `_u${i}_color`
            const rIn = vResolve(id, 'r')
            const gIn = vResolve(id, 'g')
            const bIn = vResolve(id, 'b')
            const rExpr = rIn ?? `${colorU}.r`
            const gExpr = gIn ?? `${colorU}.g`
            const bExpr = bIn ?? `${colorU}.b`
            const l1 = `vec3 ${cVar} = vec3(${rExpr}, ${gExpr}, ${bExpr});`
            const l2 = `float ${vVarName} = dot(${cVar}, vec3(0.2126, 0.7152, 0.0722));`
            vBody.push(l1, l2); vBodyFunc.push(l1, l2)
          }

          vPortVar.set(`${id}:color`, cVar)
          vPortVar.set(`${id}:value`, vVarName)
          vPortVar.set(`${id}:alpha`, aVar)
          vVar.set(id, vVarName)
          break
        }
      }
    }

    const dispValueExpr = vVar.get(dispEdge.source) ?? '0.0'

    // Displacement scale uniform (on shader/output node)
    const outNode = nodeMap.get(outputNodeId)!
    const outIdx = topoIdx.get(outputNodeId) ?? sorted.length
    const outProps = getNodeProps(outNode)
    const dscaleU = `_u${outIdx}_displacementScale`
    if (!uniforms[dscaleU]) {
      uniformDecls.push(`uniform float ${dscaleU};`)
      uniforms[dscaleU] = { value: (outProps.displacementScale as number) ?? 0.2 }
      uniformNodeMap[`${outputNodeId}:displacementScale`] = dscaleU
    }

    // Full custom vertex shader (unlit mode)
    const vParts: string[] = []
    if (needsNoise) vParts.push(NOISE_PREAMBLE)
    vParts.push(uniformDecls.join('\n'))
    vParts.push('\nvoid main() {')
    vParts.push('  vUv = uv;')
    vParts.push('  vPosition = position;')
    for (const l of vBody) vParts.push(`  ${l}`)
    vParts.push(`  vec3 dispPos = position + normal * ${dispValueExpr} * ${dscaleU};`)
    vParts.push('  gl_Position = projectionMatrix * modelViewMatrix * vec4(dispPos, 1.0);')
    vParts.push('}')
    vertexShader = vParts.join('\n')

    // PBR mode: preamble (exclude varyings already in Three.js) + injection body
    const pbrDecls = uniformDecls.filter((d) => !d.startsWith('varying'))
    const preambleParts: string[] = []
    if (needsNoise) preambleParts.push(NOISE_PREAMBLE)
    preambleParts.push(pbrDecls.join('\n'))

    if (positionNodeUsed) {
      // Generate _sg_disp(vec3 _sg_p) helper — enables finite difference normal computation
      preambleParts.push([
        `float _sg_disp(vec3 _sg_p) {`,
        ...vBodyFunc.map((l) => `  ${l}`),
        `  return ${dispValueExpr};`,
        `}`,
      ].join('\n'))
    }
    vertexPreamble = preambleParts.join('\n')

    if (positionNodeUsed) {
      // Finite difference normal computation — corrects PBR shading for displaced geometry.
      // Samples _sg_disp at 3 points to compute displacement gradient → perturbed normal.
      // Overrides vNormal (the last write in vertex main() wins for interpolation).
      vertexBodyForPBR = [
        `  float _sg_eps = 0.1;`,
        `  vec3 _sg_t = abs(normal.y) < 0.99`,
        `    ? normalize(cross(normal, vec3(0.0, 1.0, 0.0)))`,
        `    : normalize(cross(normal, vec3(1.0, 0.0, 0.0)));`,
        `  vec3 _sg_b = normalize(cross(normal, _sg_t));`,
        `  float _sg_dC = _sg_disp(position);`,
        `  float _sg_dT = _sg_disp(position + _sg_t * _sg_eps);`,
        `  float _sg_dB = _sg_disp(position + _sg_b * _sg_eps);`,
        `  float _sg_gT = clamp((_sg_dT - _sg_dC) * ${dscaleU} / _sg_eps, -1.5, 1.5);`,
        `  float _sg_gB = clamp((_sg_dB - _sg_dC) * ${dscaleU} / _sg_eps, -1.5, 1.5);`,
        `  vec3 _sg_norm = normalize(normal - _sg_t * _sg_gT - _sg_b * _sg_gB);`,
        `  #ifndef FLAT_SHADED`,
        `    vNormal = normalize(normalMatrix * _sg_norm);`,
        `  #endif`,
        `  transformed += normal * _sg_dC * ${dscaleU};`,
      ].join('\n')
    } else {
      // UV-based or simple displacement — no normal correction
      vertexBodyForPBR = [
        ...vBody.map((l) => `  ${l}`),
        `  transformed += normal * ${dispValueExpr} * ${dscaleU};`,
      ].join('\n')
    }
  }

  return { fragmentShader, vertexShader, vertexPreamble, vertexBodyForPBR, uniforms, uniformNodeMap, bridgeUniforms }
}

// Compute shader: generates a 2D simplex noise texture
// Can be sampled by fragment shaders instead of per-pixel snoise() calls
//
// Usage: dispatch with ceil(width/16) x ceil(height/16) workgroups
// Output: RGBA32Float storage texture where:
//   .r = snoise at base frequency
//   .g = fbm (4 octaves)
//   .b = snoise at 2x frequency (detail layer)
//   .a = 1.0

// --- Inline noise functions (compute shaders can't share with fragment includes) ---

fn cs_mod289_v3(x: vec3<f32>) -> vec3<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn cs_mod289_v2(x: vec2<f32>) -> vec2<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn cs_permute(x: vec3<f32>) -> vec3<f32> {
  return cs_mod289_v3(((x * 34.0) + 10.0) * x);
}

fn cs_snoise(v: vec2<f32>) -> f32 {
  let C = vec4<f32>(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);

  let i = floor(v + dot(v, C.yy));
  let x0 = v - i + dot(i, C.xx);

  var i1: vec2<f32>;
  if (x0.x > x0.y) { i1 = vec2<f32>(1.0, 0.0); } else { i1 = vec2<f32>(0.0, 1.0); }

  var x12 = x0.xyxy + C.xxzz;
  x12 = vec4<f32>(x12.xy - i1, x12.zw);

  let i_mod = cs_mod289_v2(i);
  let p = cs_permute(cs_permute(i_mod.y + vec3<f32>(0.0, i1.y, 1.0)) + i_mod.x + vec3<f32>(0.0, i1.x, 1.0));

  var m = max(0.5 - vec3<f32>(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3<f32>(0.0));
  m = m * m;
  m = m * m;

  let x_val = 2.0 * fract(p * C.www) - 1.0;
  let h = abs(x_val) - 0.5;
  let ox = floor(x_val + 0.5);
  let a0 = x_val - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  let g = vec3<f32>(a0.x * x0.x + h.x * x0.y, a0.y * x12.x + h.y * x12.y, a0.z * x12.z + h.z * x12.w);
  return 130.0 * dot(m, g);
}

fn cs_fbm(p: vec2<f32>, octaves: i32, lacunarity: f32, persistence: f32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  for (var i = 0; i < 8; i++) {
    if (i >= octaves) { break; }
    value += amplitude * cs_snoise(p * frequency);
    frequency *= lacunarity;
    amplitude *= persistence;
  }
  return value;
}

// --- Compute shader bindings ---

struct NoiseParams {
  offset: vec2<f32>,     // time-based offset for animation
  scale: f32,            // frequency multiplier
  _pad: f32,
};

@group(0) @binding(0) var output_texture: texture_storage_2d<rgba32float, write>;
@group(0) @binding(1) var<uniform> params: NoiseParams;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let dims = textureDimensions(output_texture);
  if (id.x >= dims.x || id.y >= dims.y) { return; }

  let uv = vec2<f32>(f32(id.x), f32(id.y)) / vec2<f32>(f32(dims.x), f32(dims.y));
  let p = uv * params.scale + params.offset;

  let noise_base = cs_snoise(p) * 0.5 + 0.5;
  let noise_fbm = cs_fbm(p, 4, 2.0, 0.5) * 0.5 + 0.5;
  let noise_detail = cs_snoise(p * 2.0) * 0.5 + 0.5;

  textureStore(output_texture, vec2<i32>(i32(id.x), i32(id.y)), vec4<f32>(noise_base, noise_fbm, noise_detail, 1.0));
}

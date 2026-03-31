// Common math utilities — WGSL port of math-utils.glsl

const PI: f32 = 3.14159265358979323846;
const TAU: f32 = 6.28318530717958647692;

// Remap value from one range to another
fn remap(value: f32, in_min: f32, in_max: f32, out_min: f32, out_max: f32) -> f32 {
  return out_min + (value - in_min) * (out_max - out_min) / (in_max - in_min);
}

// 2D rotation matrix
fn rotate2d(angle: f32) -> mat2x2<f32> {
  let s = sin(angle);
  let c = cos(angle);
  return mat2x2<f32>(c, -s, s, c);
}

// Hash function for pseudo-random values
fn hash(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, vec3<f32>(p3.y + 33.33, p3.z + 33.33, p3.x + 33.33));
  return fract((p3.x + p3.y) * p3.z);
}

// Smooth minimum (useful for metaballs)
fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

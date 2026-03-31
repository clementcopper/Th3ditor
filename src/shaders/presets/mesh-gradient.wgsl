// Mesh Gradient — WGSL port of mesh-gradient.frag
// Note: builtins and customs structs are injected by WebGPURenderer

#include "../common/noise-simplex.wgsl"
#include "../common/color-oklch.wgsl"

@fragment
fn fs_main(@location(0) uv_in: vec2<f32>, @builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> {
  let resolution = builtins.u_resolution;
  let time = builtins.u_time;

  let uv = vec2<f32>(frag_coord.x, resolution.y - frag_coord.y) / resolution;
  let aspect = resolution.x / resolution.y;
  let st = vec2<f32>(uv.x * aspect, uv.y);

  let t = time * customs.u_speed * 0.3;

  // Animated control points on Lissajous curves
  let p1 = vec2<f32>(
    0.3 + 0.2 * sin(t * 0.7 + 1.0),
    0.3 + 0.2 * cos(t * 0.5 + 2.0)
  ) * vec2<f32>(aspect, 1.0);

  let p2 = vec2<f32>(
    0.7 + 0.15 * sin(t * 0.6 + 3.0),
    0.7 + 0.15 * cos(t * 0.8 + 0.5)
  ) * vec2<f32>(aspect, 1.0);

  let p3 = vec2<f32>(
    0.5 + 0.25 * sin(t * 0.4 + 5.0),
    0.5 + 0.2 * cos(t * 0.9 + 1.5)
  ) * vec2<f32>(aspect, 1.0);

  let p4 = vec2<f32>(
    0.6 + 0.2 * sin(t * 0.5 + 4.0),
    0.3 + 0.25 * cos(t * 0.7 + 3.0)
  ) * vec2<f32>(aspect, 1.0);

  // Noise-based distortion
  let noise_offset = vec2<f32>(
    snoise(st * customs.u_complexity + t * 0.2),
    snoise(st * customs.u_complexity + t * 0.2 + 100.0)
  ) * customs.u_distortion * 0.3;

  let distorted_st = st + noise_offset;

  // Distances to control points
  let d1 = length(distorted_st - p1);
  let d2 = length(distorted_st - p2);
  let d3 = length(distorted_st - p3);
  let d4 = length(distorted_st - p4);

  // Soft weighted blending
  let soft = customs.u_softness * 2.0 + 0.5;
  let w1 = 1.0 / (pow(d1, soft) + 0.001);
  let w2 = 1.0 / (pow(d2, soft) + 0.001);
  let w3 = 1.0 / (pow(d3, soft) + 0.001);
  let w4 = 1.0 / (pow(d4, soft) + 0.001);
  let w_total = w1 + w2 + w3 + w4;

  // Mix colors in Oklab space
  let lab1 = rgb2oklab(customs.u_color1.xyz);
  let lab2 = rgb2oklab(customs.u_color2.xyz);
  let lab3 = rgb2oklab(customs.u_color3.xyz);
  let lab4 = rgb2oklab(customs.u_color4.xyz);

  let lab_mixed = (lab1 * w1 + lab2 * w2 + lab3 * w3 + lab4 * w4) / w_total;
  var color = oklab2rgb(lab_mixed);

  // Weighted alpha blend
  let alpha = (customs.u_color1_alpha * w1 + customs.u_color2_alpha * w2 + customs.u_color3_alpha * w3 + customs.u_color4_alpha * w4) / w_total;

  // Film grain
  if (customs.u_grain > 0.0) {
    let grain = (fract(sin(dot(frag_coord.xy, vec2<f32>(12.9898, 78.233)) + time) * 43758.5453) - 0.5) * customs.u_grain * 0.15;
    color += grain;
  }

  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(color, alpha);
}

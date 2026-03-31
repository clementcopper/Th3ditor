// Organic Blob — WGSL port of organic-blob.frag

#include "../common/noise-simplex.wgsl"
#include "../common/color-oklch.wgsl"
#include "../common/math-utils.wgsl"

@fragment
fn fs_main(@location(0) uv_in: vec2<f32>, @builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> {
  let resolution = builtins.u_resolution;
  let time = builtins.u_time;

  let uv = vec2<f32>(frag_coord.x, resolution.y - frag_coord.y) / resolution;
  let aspect = resolution.x / resolution.y;
  let p = (uv - 0.5) * vec2<f32>(aspect, 1.0);
  let t = time * customs.u_speed;

  var d = 1e5;

  for (var i = 0.0; i < 6.0; i += 1.0) {
    if (i >= customs.u_blobCount) { break; }

    let angle = TAU * i / customs.u_blobCount + t * 0.3;
    let radius = 0.15 + 0.05 * sin(t * customs.u_pulseSpeed + i * 1.7);
    var center = vec2<f32>(cos(angle), sin(angle)) * 0.2;

    center += vec2<f32>(
      snoise(vec2<f32>(t * 0.5 + i * 3.0, 0.0)),
      snoise(vec2<f32>(0.0, t * 0.5 + i * 3.0))
    ) * 0.1;

    let blob_dist = length(p - center) - radius * customs.u_size;
    d = smin(d, blob_dist, customs.u_smoothness * 0.5);
  }

  let edge = smoothstep(0.02, -0.02, d);
  let inner = smoothstep(0.1, -0.1, d);

  let blob_mix = inner * 0.7 + 0.15;
  let blob_color = mix_oklab(customs.u_color1.xyz, customs.u_color2.xyz, blob_mix);
  let blob_alpha = mix(customs.u_color1_alpha, customs.u_color2_alpha, blob_mix);
  var color = mix(customs.u_bgColor.xyz, blob_color, edge);

  let glow = exp(-d * 8.0) * 0.3;
  color += mix_oklab(customs.u_color1.xyz, customs.u_color2.xyz, 0.5) * glow;

  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
  let fg_visibility = max(edge, glow * 2.0);
  let alpha = mix(customs.u_bgColor_alpha, blob_alpha, fg_visibility);
  return vec4<f32>(color, alpha);
}

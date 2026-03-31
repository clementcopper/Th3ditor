// Aurora Borealis — WGSL port of aurora.frag

#include "../common/noise-simplex.wgsl"
#include "../common/color-oklch.wgsl"

@fragment
fn fs_main(@location(0) uv_in: vec2<f32>, @builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> {
  let resolution = builtins.u_resolution;
  let time = builtins.u_time;

  let uv = vec2<f32>(frag_coord.x, resolution.y - frag_coord.y) / resolution;
  let t = time * customs.u_speed * 0.4;

  var color = vec3<f32>(0.0);
  var total_alpha = 0.0;

  for (var i = 0.0; i < 6.0; i += 1.0) {
    if (i >= customs.u_ribbonCount) { break; }

    let ribbon_offset = i / customs.u_ribbonCount;
    let base_y = 0.3 + ribbon_offset * 0.4;

    var wave = snoise(vec2<f32>(uv.x * 3.0 + t + i * 1.7, t * 0.3 + i * 0.5)) * 0.15;
    wave += snoise(vec2<f32>(uv.x * 7.0 - t * 0.5 + i * 2.3, t * 0.2)) * 0.08;
    wave *= customs.u_verticalDrift;

    let y = base_y + wave;
    let dist = abs(uv.y - y);

    let ribbon_width = 0.04 + 0.02 * sin(t + i * 2.0);
    var intensity = smoothstep(ribbon_width, 0.0, dist);
    intensity *= customs.u_brightness;

    let shimmer = snoise(vec2<f32>(uv.x * 20.0 + t * 2.0, uv.y * 10.0 + i * 5.0));
    intensity *= 0.7 + 0.3 * shimmer;

    let color_mix = fract(ribbon_offset * 1.5 + t * 0.1);
    var ribbon_color: vec3<f32>;
    var ribbon_alpha: f32;
    if (color_mix < 0.5) {
      let t2 = color_mix * 2.0;
      ribbon_color = mix_oklab(customs.u_color1.xyz, customs.u_color2.xyz, t2);
      ribbon_alpha = mix(customs.u_color1_alpha, customs.u_color2_alpha, t2);
    } else {
      let t2 = (color_mix - 0.5) * 2.0;
      ribbon_color = mix_oklab(customs.u_color2.xyz, customs.u_color3.xyz, t2);
      ribbon_alpha = mix(customs.u_color2_alpha, customs.u_color3_alpha, t2);
    }

    color += ribbon_color * intensity * ribbon_alpha;
    total_alpha += intensity * ribbon_alpha;
  }

  var edge_fade = 1.0;
  if (customs.u_fadeEdges > 0.0) {
    edge_fade *= smoothstep(0.0, customs.u_fadeEdges * 0.3, uv.x);
    edge_fade *= smoothstep(0.0, customs.u_fadeEdges * 0.3, 1.0 - uv.x);
    edge_fade *= smoothstep(0.0, customs.u_fadeEdges * 0.2, uv.y);
    edge_fade *= smoothstep(0.0, customs.u_fadeEdges * 0.2, 1.0 - uv.y);
  }

  color *= edge_fade;
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
  let alpha = clamp(total_alpha, 0.0, 1.0);
  return vec4<f32>(color, alpha);
}

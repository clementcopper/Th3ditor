// Dot Matrix — WGSL port of dot-matrix.frag

#include "../common/noise-simplex.wgsl"
#include "../common/color-oklch.wgsl"
#include "../common/math-utils.wgsl"

fn rot2d_dm(p: vec2<f32>, a: f32) -> vec2<f32> {
  let c = cos(a);
  let s = sin(a);
  return vec2<f32>(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn dot_dist(f: vec2<f32>, shape: f32) -> f32 {
  if (shape < 0.5) { return length(f); }
  if (shape < 1.5) { return max(abs(f.x), abs(f.y)); }
  return abs(f.x) + abs(f.y);
}

@fragment
fn fs_main(@location(0) uv_in: vec2<f32>, @builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> {
  let resolution = builtins.u_resolution;
  let time = builtins.u_time;
  let mouse = builtins.u_mouse;

  let uv = vec2<f32>(frag_coord.x, resolution.y - frag_coord.y) / resolution;
  let aspect = resolution.x / resolution.y;
  var p = (uv - 0.5) * vec2<f32>(aspect, 1.0);
  let t = time * customs.u_speed;

  // Rotate grid
  p = rot2d_dm(p, radians(customs.u_rotation));
  p += 0.5 * vec2<f32>(aspect, 1.0);

  // Grid
  let eff_grid = customs.u_gridSize / customs.u_spacing;
  let cell = floor(p * eff_grid);
  let f = fract(p * eff_grid) - 0.5;
  let cell_center = (cell + 0.5) / eff_grid;

  let freq = customs.u_frequency;

  // Modulation
  var mod_value: f32;
  if (customs.u_modulationType < 0.5) {
    mod_value = snoise(cell * 0.3 * freq * 0.3 + t * 0.5) * 0.5 + 0.5;
  } else if (customs.u_modulationType < 1.5) {
    let center = vec2<f32>(aspect * 0.5, 0.5);
    let dist = length(cell_center - center);
    mod_value = sin(dist * freq * 3.0 - t * 2.0) * 0.5 + 0.5;
  } else if (customs.u_modulationType < 2.5) {
    mod_value = sin(cell_center.x * freq * 2.5 + t) * sin(cell_center.y * freq * 2.5 + t * 0.7) * 0.5 + 0.5;
  } else if (customs.u_modulationType < 3.5) {
    let cx = cell.x % 2.0;
    let cy = cell.y % 2.0;
    let checker = (cx + cy) % 2.0;
    mod_value = mix(0.2, 0.9, checker) + sin(t) * 0.1;
  } else if (customs.u_modulationType < 4.5) {
    let center = vec2<f32>(aspect * 0.5, 0.5);
    let dv = cell_center - center;
    let angle = atan2(dv.y, dv.x);
    let dist = length(dv);
    mod_value = sin(angle * freq + dist * freq * 5.0 - t * 2.0) * 0.5 + 0.5;
  } else if (customs.u_modulationType < 5.5) {
    let scan_pos = fract(t * 0.3) * (1.0 + 0.3);
    let dist = abs(cell_center.y - scan_pos);
    mod_value = exp(-dist * freq * 3.0);
  } else if (customs.u_modulationType < 6.5) {
    let angle = freq * 0.5;
    let grad = dot(cell_center, vec2<f32>(cos(angle), sin(angle)));
    mod_value = fract(grad * 2.0 + t * 0.2);
  } else {
    let center = vec2<f32>(aspect * 0.5, 0.5);
    let dist = length(cell_center - center);
    let cycle = fract(t * 0.5);
    let ring = cycle * 1.5;
    mod_value = exp(-freq * 2.0 * (dist - ring) * (dist - ring)) * (1.0 - cycle);
  }

  mod_value = clamp(mod_value, 0.0, 1.0);

  // Interaction
  var interact_offset = 0.0;
  var pos_offset = vec2<f32>(0.0);

  if (customs.u_interactMode > 0.5) {
    var mp = (mouse - 0.5) * vec2<f32>(aspect, 1.0);
    mp = rot2d_dm(mp, radians(customs.u_rotation));
    mp += 0.5 * vec2<f32>(aspect, 1.0);
    let md = length(cell_center - mp);
    let raw = smoothstep(customs.u_interactRadius, 0.0, md);
    let influence = pow(raw, customs.u_interactFalloff) * customs.u_interactStrength;

    if (customs.u_interactMode < 1.5) {
      interact_offset = influence;
    } else if (customs.u_interactMode < 2.5) {
      interact_offset = -influence;
    } else if (customs.u_interactMode < 3.5) {
      var dir = vec2<f32>(0.0);
      if (md > 0.001) { dir = normalize(mp - cell_center); }
      pos_offset = dir * influence * 0.4;
    } else {
      mod_value *= influence;
    }
  }

  mod_value = clamp(mod_value + interact_offset, 0.0, 1.0);

  let radius = mix(customs.u_dotMin, customs.u_dotMax, mod_value) * 0.45 * min(customs.u_spacing, 1.0);
  // Limit magnet offset so dot stays fully inside its cell
  let max_shift = max(0.48 - radius, 0.0);
  let o_len = length(pos_offset);
  if (o_len > max_shift && o_len > 0.001) {
    pos_offset = pos_offset / o_len * max_shift;
  }
  let dot_pos = f - pos_offset;
  let d = dot_dist(dot_pos, customs.u_dotShape);
  let dot_val = smoothstep(radius, radius - 0.02, d);

  let dot_col = mix_oklab(customs.u_dotColor.xyz, customs.u_highlightColor.xyz, mod_value);
  let dot_alpha = mix(customs.u_dotColor_alpha, customs.u_highlightColor_alpha, mod_value);
  let color = mix(customs.u_bgColor.xyz, dot_col, dot_val);

  let final_color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
  let alpha = mix(customs.u_bgColor_alpha, dot_alpha, dot_val);
  return vec4<f32>(final_color, alpha);
}

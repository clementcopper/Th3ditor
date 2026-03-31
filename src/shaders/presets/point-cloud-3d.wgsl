// Point Cloud 3D — WGSL port of point-cloud-3d.frag

#include "../common/noise-simplex.wgsl"
#include "../common/color-oklch.wgsl"
#include "../common/math-utils.wgsl"

fn pc_deform(p: vec3<f32>, t: f32) -> f32 {
  let freq = customs.u_frequency;
  let dec = customs.u_decay;
  let amp = customs.u_amplitude;

  if (customs.u_deformType < 0.5) { return 0.0; }
  if (customs.u_deformType < 1.5) { return sin(p.x * freq + t * 2.0) * cos(p.z * freq + t * 1.5) * amp; }
  if (customs.u_deformType < 2.5) { return fbm(p.xz * freq * 0.7 + t * 0.3, 4, 2.0, 0.5) * amp; }
  if (customs.u_deformType < 3.5) { return sin(p.y * freq + t + length(p.xz) * freq * 1.3) * amp * 0.5; }
  if (customs.u_deformType < 4.5) {
    let r = length(p.xz);
    return sin(r * freq * 2.5 - t * 3.0) * amp * 0.5 * exp(-r * dec);
  }
  if (customs.u_deformType < 5.5) {
    let squeeze = sin(p.y * PI * freq * 0.3 + t) * amp;
    return -length(p.xz) * squeeze;
  }
  if (customs.u_deformType < 6.5) {
    let n = snoise(p.xz * freq * 0.7 + t * 0.5);
    let d = length(p);
    return (d + n * 0.5) * amp * (0.5 + 0.5 * sin(t * 1.5));
  }
  if (customs.u_deformType < 7.5) {
    let d = length(p);
    let cycle = fract(t * 0.8);
    let ring = cycle * 3.0;
    let sharpness = freq * 1.3;
    let wave = exp(-sharpness * (d - ring) * (d - ring));
    let fade = exp(-cycle * dec * 3.0);
    return wave * fade * amp;
  }
  return sin(t * freq * 0.7) * amp * 0.3;
}

// Project grid point to screen. Returns vec4(scr.xy, depth, hval)
// cols = number of columns, rows = number of rows
fn project_point(ix: f32, iy: f32, cols: f32, rows: f32, tp: f32, t: f32, gs: f32,
                 cos_ry: f32, sin_ry: f32, cos_rx: f32, sin_rx: f32) -> vec4<f32> {
  let nu = ix / max(cols - 1.0, 1.0);
  let nv = iy / max(rows - 1.0, 1.0);

  var bp: vec3<f32>;
  if (customs.u_shapeType > 1.5) {
    let idx = iy * gs + ix;
    let ga = PI * (3.0 - sqrt(5.0));
    let y = 1.0 - (2.0 * idx + 1.0) / tp;
    let r = sqrt(1.0 - y * y);
    bp = vec3<f32>(r * cos(ga * idx), y, r * sin(ga * idx));
  } else if (customs.u_shapeType > 0.5) {
    let th = nu * PI;
    let ph = nv * TAU;
    bp = vec3<f32>(sin(th) * cos(ph), cos(th), sin(th) * sin(ph));
  } else {
    bp = vec3<f32>((nu - 0.5) * 2.0, 0.0, (nv - 0.5) * 2.0);
  }

  let def = pc_deform(bp, t);
  var gp: vec3<f32>;
  if (customs.u_shapeType < 0.5) {
    gp = vec3<f32>(bp.x, def, bp.z);
  } else {
    var d = def;
    if (customs.u_deformOutward > 0.5) { d = max(def, 0.0); }
    gp = bp * (1.0 + d);
  }
  let sgp = gp * customs.u_scale;

  let r1 = vec3<f32>(
    cos_ry * sgp.x + sin_ry * sgp.z,
    sgp.y,
    -sin_ry * sgp.x + cos_ry * sgp.z
  );
  var pos = vec3<f32>(
    r1.x,
    cos_rx * r1.y - sin_rx * r1.z,
    sin_rx * r1.y + cos_rx * r1.z
  );
  pos.x += customs.u_posX;
  pos.y += customs.u_posY;

  let depth = customs.u_perspective + pos.z;
  let scr = pos.xy / max(depth, 0.1);

  var hv: f32;
  if (customs.u_deformType < 0.5 && customs.u_shapeType > 0.5) {
    hv = bp.y;
  } else {
    hv = def;
  }
  return vec4<f32>(scr, depth, hv);
}

fn apply_interaction(scr_in: vec2<f32>, mouse: vec2<f32>, resolution: vec2<f32>) -> vec2<f32> {
  if (customs.u_interactMode < 0.5) { return scr_in; }
  let aspect = resolution.x / resolution.y;
  let mc = (mouse - 0.5) * vec2<f32>(aspect, 1.0);
  let to_mouse = mc - scr_in;
  let md = length(to_mouse);
  let raw = smoothstep(customs.u_interactRadius, 0.0, md);
  let influence = pow(raw, customs.u_interactFalloff) * customs.u_interactStrength * 0.15;
  var dir = vec2<f32>(0.0);
  if (md > 0.001) { dir = normalize(to_mouse); }
  if (customs.u_interactMode < 1.5) {
    return scr_in + dir * influence;
  }
  return scr_in - dir * influence;
}

fn segment_dist(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
  let ab = b - a;
  let len2 = dot(ab, ab);
  if (len2 < 0.000001) { return length(p - a); }
  let t = clamp(dot(p - a, ab) / len2, 0.0, 1.0);
  return length(p - (a + t * ab));
}

@fragment
fn fs_main(@location(0) uv_in: vec2<f32>, @builtin(position) frag_coord: vec4<f32>) -> @location(0) vec4<f32> {
  let resolution = builtins.u_resolution;
  let time = builtins.u_time;
  let mouse = builtins.u_mouse;

  let uv = vec2<f32>(frag_coord.x, resolution.y - frag_coord.y) / resolution;
  let centered = (uv - 0.5) * vec2<f32>(resolution.x / resolution.y, 1.0);
  let t = time * customs.u_speed;

  var color = customs.u_bgColor.xyz;
  var total_dot = 0.0;

  let gs = customs.u_gridDensity;
  let tp = gs * gs;
  let cos_ry = cos(radians(customs.u_rotateY));
  let sin_ry = sin(radians(customs.u_rotateY));
  let cos_rx = cos(radians(customs.u_rotateX));
  let sin_rx = sin(radians(customs.u_rotateX));
  let line_mode = customs.u_renderMode > 0.5;
  let cols = gs;                                                  // number of lines/columns
  var rows = gs;
  if (line_mode) { rows = customs.u_lineSegments; }               // points per line

  for (var iy = 0.0; iy < 60.0; iy += 1.0) {
    if (iy >= rows) { break; }
    for (var ix = 0.0; ix < 30.0; ix += 1.0) {
      if (ix >= cols) { break; }

      let pt = project_point(ix, iy, cols, rows, tp, t, gs, cos_ry, sin_ry, cos_rx, sin_rx);
      if (pt.z < 0.1) { continue; }

      let scr = apply_interaction(pt.xy, mouse, resolution);
      let depth = pt.z;
      let hv = pt.w;

      if (line_mode && iy + 1.0 < rows) {
        // Lines: draw segment to next point in column
        let pt_next = project_point(ix, iy + 1.0, cols, rows, tp, t, gs, cos_ry, sin_ry, cos_rx, sin_rx);
        if (pt_next.z >= 0.1) {
          let scr_next = apply_interaction(pt_next.xy, mouse, resolution);
          let avg_depth = (depth + pt_next.z) * 0.5;
          let line_r = customs.u_dotSize * 0.005 / avg_depth;
          let line_fade = 2.0 / (avg_depth * avg_depth);
          let sd = segment_dist(centered, scr, scr_next);
          let line_val = smoothstep(line_r, line_r * 0.2, sd) * line_fade;

          let hn = hv / max(customs.u_amplitude, 0.01) * 0.5 + 0.5;
          let line_col = mix_oklab(customs.u_dotColor.xyz, customs.u_highlightColor.xyz, hn);
          let line_alpha = mix(customs.u_dotColor_alpha, customs.u_highlightColor_alpha, hn);

          color = mix(color, line_col, min(line_val, 1.0));
          total_dot += line_val * line_alpha;
        }
      } else if (!line_mode) {
        // Points: draw dot
        let dist = length(centered - scr);
        let dot_r = customs.u_dotSize * 0.008 / depth;
        let depth_fade = 2.0 / (depth * depth);
        let dot_val = smoothstep(dot_r, dot_r * 0.3, dist) * depth_fade;

        let hn = hv / max(customs.u_amplitude, 0.01) * 0.5 + 0.5;
        let dot_col = mix_oklab(customs.u_dotColor.xyz, customs.u_highlightColor.xyz, hn);
        let dot_alpha = mix(customs.u_dotColor_alpha, customs.u_highlightColor_alpha, hn);

        color = mix(color, dot_col, min(dot_val, 1.0));
        total_dot += dot_val * dot_alpha;
      }
    }
  }

  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
  let alpha = mix(customs.u_bgColor_alpha, 1.0, clamp(total_dot, 0.0, 1.0));
  return vec4<f32>(color, alpha);
}

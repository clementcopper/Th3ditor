// Simplex 2D noise — WGSL port of noise-simplex.glsl
// Based on Ashima Arts: https://github.com/ashima/webgl-noise
// Note: WGSL has no function overloading, so we use _v2 / _v3 suffixes

fn mod289_v3(x: vec3<f32>) -> vec3<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_v2(x: vec2<f32>) -> vec2<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute(x: vec3<f32>) -> vec3<f32> {
  return mod289_v3(((x * 34.0) + 10.0) * x);
}

fn snoise(v: vec2<f32>) -> f32 {
  let C = vec4<f32>(
    0.211324865405187,   // (3.0-sqrt(3.0))/6.0
    0.366025403784439,   // 0.5*(sqrt(3.0)-1.0)
    -0.577350269189626,  // -1.0 + 2.0 * C.x
    0.024390243902439    // 1.0 / 41.0
  );

  let i = floor(v + dot(v, C.yy));
  let x0 = v - i + dot(i, C.xx);

  var i1: vec2<f32>;
  if (x0.x > x0.y) {
    i1 = vec2<f32>(1.0, 0.0);
  } else {
    i1 = vec2<f32>(0.0, 1.0);
  }

  var x12 = x0.xyxy + C.xxzz;
  x12 = vec4<f32>(x12.xy - i1, x12.zw);

  let i_mod = mod289_v2(i);
  let p = permute(
    permute(i_mod.y + vec3<f32>(0.0, i1.y, 1.0))
    + i_mod.x + vec3<f32>(0.0, i1.x, 1.0)
  );

  var m = max(
    0.5 - vec3<f32>(
      dot(x0, x0),
      dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)
    ),
    vec3<f32>(0.0)
  );
  m = m * m;
  m = m * m;

  let x_val = 2.0 * fract(p * C.www) - 1.0;
  let h = abs(x_val) - 0.5;
  let ox = floor(x_val + 0.5);
  let a0 = x_val - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  let g = vec3<f32>(
    a0.x * x0.x + h.x * x0.y,
    a0.y * x12.x + h.y * x12.y,
    a0.z * x12.z + h.z * x12.w
  );
  return 130.0 * dot(m, g);
}

// FBM using simplex noise
fn fbm(p: vec2<f32>, octaves: i32, lacunarity: f32, persistence: f32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  for (var i = 0; i < 8; i++) {
    if (i >= octaves) { break; }
    value += amplitude * snoise(p * frequency);
    frequency *= lacunarity;
    amplitude *= persistence;
  }
  return value;
}

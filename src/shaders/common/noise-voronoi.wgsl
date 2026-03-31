// Voronoi / Worley noise — WGSL port of noise-voronoi.glsl

fn voronoi_hash(p: vec2<f32>) -> vec2<f32> {
  let q = vec2<f32>(dot(p, vec2<f32>(127.1, 311.7)), dot(p, vec2<f32>(269.5, 183.3)));
  return fract(sin(q) * 43758.5453);
}

// Returns vec3(minDist, secondMinDist, cellId)
fn voronoi(p: vec2<f32>, time: f32) -> vec3<f32> {
  let ip = floor(p);
  let fp = fract(p);

  var d1 = 8.0;
  var d2 = 8.0;
  var cell_id = 0.0;

  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let neighbor = vec2<f32>(f32(x), f32(y));
      var random_offset = voronoi_hash(ip + neighbor);
      random_offset = 0.5 + 0.5 * sin(time + 6.2831 * random_offset);
      let diff = neighbor + random_offset - fp;
      let dist = length(diff);

      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        cell_id = dot(ip + neighbor, vec2<f32>(7.0, 113.0));
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }

  return vec3<f32>(d1, d2, cell_id);
}

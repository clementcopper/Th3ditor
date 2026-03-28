// Voronoi / Worley noise

vec2 voronoiHash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Returns vec3(minDist, secondMinDist, cellId)
vec3 voronoi(vec2 p, float time) {
  vec2 ip = floor(p);
  vec2 fp = fract(p);

  float d1 = 8.0;
  float d2 = 8.0;
  float cellId = 0.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 randomOffset = voronoiHash(ip + neighbor);
      randomOffset = 0.5 + 0.5 * sin(time + 6.2831 * randomOffset);
      vec2 diff = neighbor + randomOffset - fp;
      float dist = length(diff);

      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        cellId = dot(ip + neighbor, vec2(7.0, 113.0));
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }

  return vec3(d1, d2, cellId);
}

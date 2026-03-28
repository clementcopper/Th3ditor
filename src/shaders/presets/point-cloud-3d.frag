#version 300 es
precision highp float;

#include "../common/noise-simplex.glsl"
#include "../common/color-oklch.glsl"
#include "../common/math-utils.glsl"

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

uniform vec3 u_dotColor;
uniform float u_dotColor_alpha;
uniform vec3 u_bgColor;
uniform float u_bgColor_alpha;
uniform vec3 u_highlightColor;
uniform float u_highlightColor_alpha;
uniform float u_speed;
uniform float u_gridDensity;
uniform float u_dotSize;
uniform float u_amplitude;
uniform float u_perspective;
uniform float u_rotateX;
uniform float u_rotateY;
uniform float u_posX;
uniform float u_posY;
uniform float u_scale;
uniform float u_shapeType;  // 0=surface, 1=sphere
uniform float u_deformType; // 0=none, 1=wave, 2=terrain, 3=twist

out vec4 fragColor;

// 3D rotation
vec3 rotateY(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

vec3 rotateX(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

// ── Base shapes ──

// Flat surface from normalized UV
vec3 shapeSurface(float u, float v) {
  return vec3((u - 0.5) * 2.0, 0.0, (v - 0.5) * 2.0);
}

// Closed sphere from normalized UV
vec3 shapeSphere(float u, float v) {
  float theta = u * PI;        // polar 0..PI
  float phi = v * 2.0 * PI;   // azimuth 0..2PI
  return vec3(
    sin(theta) * cos(phi),
    cos(theta),
    sin(theta) * sin(phi)
  );
}

// ── Deformations (applied as displacement along normal) ──

// Wave: displaces Y (surface) or radial (sphere)
float deformWave(vec3 p, float t) {
  return sin(p.x * 3.0 + t * 2.0) * cos(p.z * 3.0 + t * 1.5) * u_amplitude;
}

// Terrain: FBM noise displacement
float deformTerrain(vec3 p, float t) {
  return fbm(p.xz * 2.0 + t * 0.3, 4, 2.0, 0.5) * u_amplitude;
}

// Twist: angular twist displacement
float deformTwist(vec3 p, float t) {
  float angle = p.y * 3.0 + t;
  float r = length(p.xz);
  return sin(angle + r * 4.0) * u_amplitude * 0.5;
}

float getDeformation(vec3 p, float t) {
  if (u_deformType < 0.5) return 0.0;       // None
  if (u_deformType < 1.5) return deformWave(p, t);
  if (u_deformType < 2.5) return deformTerrain(p, t);
  return deformTwist(p, t);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 centered = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float t = u_time * u_speed;

  vec3 color = u_bgColor;
  float totalDot = 0.0;

  float gridSize = u_gridDensity;

  // Rotation from manual controls
  float rotY = u_rotateY;
  float rotX = u_rotateX;

  for (float iy = 0.0; iy < 30.0; iy++) {
    if (iy >= gridSize) break;
    for (float ix = 0.0; ix < 30.0; ix++) {
      if (ix >= gridSize) break;

      float nu = ix / (gridSize - 1.0);
      float nv = iy / (gridSize - 1.0);

      // Base shape
      vec3 basePoint;
      if (u_shapeType < 0.5) {
        basePoint = shapeSurface(nu, nv);
      } else {
        basePoint = shapeSphere(nu, nv);
      }

      // Apply deformation
      float deform = getDeformation(basePoint, t);

      vec3 gridPoint;
      if (u_shapeType < 0.5) {
        // Surface: displace Y
        gridPoint = basePoint;
        gridPoint.y = deform;
      } else {
        // Sphere: displace along radial direction (normal = normalize(basePoint))
        float radius = 1.0 + deform;
        gridPoint = basePoint * radius;
      }

      // Scale
      gridPoint *= u_scale;

      // Rotate
      vec3 rotated = rotateX(rotateY(gridPoint, rotY), rotX);

      // Position offset
      rotated.x += u_posX;
      rotated.y += u_posY;

      // Perspective projection
      float depth = u_perspective + rotated.z;
      if (depth < 0.1) continue;
      vec2 projected = rotated.xy / depth;

      // Distance from fragment to projected point
      float dist = length(centered - projected);

      // Dot size varies with depth
      float dotRadius = u_dotSize * 0.008 / depth;
      float dot = smoothstep(dotRadius, dotRadius * 0.3, dist);

      // Color based on deformation amount (or Y for no-deform sphere)
      float heightVal = (u_deformType < 0.5 && u_shapeType > 0.5) ? basePoint.y : deform;
      float heightNorm = (heightVal / max(u_amplitude, 0.01)) * 0.5 + 0.5;
      vec3 dotCol = mixOklab(u_dotColor, u_highlightColor, heightNorm);
      float dotAlpha = mix(u_dotColor_alpha, u_highlightColor_alpha, heightNorm);

      // Depth fade
      float depthFade = 1.0 / (depth * depth);
      dot *= depthFade * 2.0;

      color = mix(color, dotCol, min(dot, 1.0));
      totalDot += dot * dotAlpha;
    }
  }

  color = clamp(color, 0.0, 1.0);
  float alpha = mix(u_bgColor_alpha, 1.0, clamp(totalDot, 0.0, 1.0));
  fragColor = vec4(color, alpha);
}

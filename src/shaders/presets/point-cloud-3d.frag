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
uniform float u_rotationSpeed;
uniform float u_deformType; // 0=wave, 1=sphere, 2=terrain, 3=twist

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

// Deformation functions
float deformWave(vec3 p, float t) {
  return sin(p.x * 3.0 + t * 2.0) * cos(p.z * 3.0 + t * 1.5) * u_amplitude;
}

float deformSphere(vec3 p, float t) {
  float r = length(p.xz);
  float target = sqrt(max(0.0, 1.0 - r * r)) * u_amplitude;
  float pulse = 1.0 + 0.1 * sin(t * 2.0);
  return target * pulse;
}

float deformTerrain(vec3 p, float t) {
  return fbm(p.xz * 2.0 + t * 0.3, 4, 2.0, 0.5) * u_amplitude;
}

float deformTwist(vec3 p, float t) {
  float angle = p.y * 3.0 + t;
  float r = length(p.xz);
  return sin(angle + r * 4.0) * u_amplitude * 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 centered = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float t = u_time * u_speed;

  vec3 color = u_bgColor;
  float totalDot = 0.0;

  float gridSize = u_gridDensity;
  float spacing = 2.0 / gridSize;

  // Rotation from time and mouse
  float rotY = t * u_rotationSpeed * 0.5 + u_mouse.x * PI;
  float rotX = -0.3 + u_mouse.y * 0.5;

  for (float iy = 0.0; iy < 40.0; iy++) {
    if (iy >= gridSize) break;
    for (float ix = 0.0; ix < 40.0; ix++) {
      if (ix >= gridSize) break;

      // Grid point in 3D space
      vec3 gridPoint = vec3(
        (ix / (gridSize - 1.0) - 0.5) * 2.0,
        0.0,
        (iy / (gridSize - 1.0) - 0.5) * 2.0
      );

      // Apply deformation
      float deform;
      if (u_deformType < 0.5) {
        deform = deformWave(gridPoint, t);
      } else if (u_deformType < 1.5) {
        deform = deformSphere(gridPoint, t);
      } else if (u_deformType < 2.5) {
        deform = deformTerrain(gridPoint, t);
      } else {
        deform = deformTwist(gridPoint, t);
      }
      gridPoint.y = deform;

      // Rotate
      vec3 rotated = rotateX(rotateY(gridPoint, rotY), rotX);

      // Perspective projection
      float depth = u_perspective + rotated.z;
      if (depth < 0.1) continue;
      vec2 projected = rotated.xy / depth;

      // Distance from fragment to projected point
      float dist = length(centered - projected);

      // Dot size varies with depth
      float dotRadius = u_dotSize * 0.008 / depth;
      float dot = smoothstep(dotRadius, dotRadius * 0.3, dist);

      // Color based on height
      float heightNorm = (deform / max(u_amplitude, 0.01)) * 0.5 + 0.5;
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

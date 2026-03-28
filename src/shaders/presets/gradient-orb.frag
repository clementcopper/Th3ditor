#version 300 es
precision highp float;

#include "../common/noise-simplex.glsl"
#include "../common/color-oklch.glsl"

uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_innerColor;
uniform float u_innerColor_alpha;
uniform vec3 u_outerColor;
uniform float u_outerColor_alpha;
uniform vec3 u_bgColor;
uniform float u_bgColor_alpha;
uniform float u_speed;
uniform float u_orbSize;
uniform float u_glowRadius;
uniform float u_driftSpeed;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = u_time * u_speed;

  // Drifting orb center
  vec2 center = vec2(
    sin(t * u_driftSpeed * 0.3) * 0.1,
    cos(t * u_driftSpeed * 0.2) * 0.08
  );

  float dist = length(p - center);

  // Orb shape with noise distortion
  float noiseVal = snoise(vec2(atan(p.y - center.y, p.x - center.x) * 3.0, t * 0.5)) * 0.03;
  float orbEdge = u_orbSize * 0.3 + noiseVal;

  // Inner to outer gradient
  float innerFactor = smoothstep(orbEdge, 0.0, dist);
  vec3 orbColor = mixOklab(u_outerColor, u_innerColor, innerFactor);
  float orbAlpha = mix(u_outerColor_alpha, u_innerColor_alpha, innerFactor);

  // Glow
  float glow = exp(-dist / (u_glowRadius * 0.3)) * 0.6;
  float orbMask = smoothstep(orbEdge + 0.02, orbEdge - 0.02, dist);

  vec3 color = u_bgColor;
  color = mix(color, mixOklab(u_outerColor, u_bgColor, 0.5), glow);
  color = mix(color, orbColor, orbMask);

  color = clamp(color, 0.0, 1.0);
  float fgVisibility = max(orbMask, glow * 1.5);
  float alpha = mix(u_bgColor_alpha, orbAlpha, fgVisibility);
  fragColor = vec4(color, alpha);
}

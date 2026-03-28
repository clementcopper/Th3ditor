#version 300 es
precision highp float;

#include "../common/noise-simplex.glsl"
#include "../common/color-oklch.glsl"
#include "../common/math-utils.glsl"

uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_dotColor;
uniform float u_dotColor_alpha;
uniform vec3 u_bgColor;
uniform float u_bgColor_alpha;
uniform float u_speed;
uniform float u_gridSize;
uniform float u_dotMin;
uniform float u_dotMax;
uniform float u_modulationType; // 0=noise, 1=radial, 2=wave

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = uv * vec2(aspect, 1.0);
  float t = u_time * u_speed;

  // Grid
  vec2 cell = floor(p * u_gridSize);
  vec2 f = fract(p * u_gridSize) - 0.5;

  // Modulation value (0-1) determines dot size
  float modValue;
  vec2 cellCenter = (cell + 0.5) / u_gridSize;

  if (u_modulationType < 0.5) {
    // Noise modulation
    modValue = snoise(cell * 0.3 + t * 0.5) * 0.5 + 0.5;
  } else if (u_modulationType < 1.5) {
    // Radial modulation
    vec2 center = vec2(aspect * 0.5, 0.5);
    float dist = length(cellCenter - center);
    modValue = sin(dist * 10.0 - t * 2.0) * 0.5 + 0.5;
  } else {
    // Wave modulation
    modValue = sin(cellCenter.x * 8.0 + t) * sin(cellCenter.y * 8.0 + t * 0.7) * 0.5 + 0.5;
  }

  // Dot radius
  float radius = mix(u_dotMin, u_dotMax, modValue) * 0.45;
  float dist = length(f);
  float dot = smoothstep(radius, radius - 0.02, dist);

  // Color variation by modulation
  vec3 color = mix(u_bgColor, mixOklab(u_dotColor, u_bgColor, 1.0 - modValue * 0.7), dot);

  color = clamp(color, 0.0, 1.0);
  float alpha = mix(u_bgColor_alpha, u_dotColor_alpha, dot);
  fragColor = vec4(color, alpha);
}

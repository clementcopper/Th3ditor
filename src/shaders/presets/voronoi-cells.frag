#version 300 es
precision highp float;

#include "../common/noise-voronoi.glsl"
#include "../common/color-oklch.glsl"
#include "../common/math-utils.glsl"

uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_cellColor;
uniform float u_cellColor_alpha;
uniform vec3 u_edgeColor;
uniform float u_edgeColor_alpha;
uniform vec3 u_bgColor;
uniform float u_bgColor_alpha;
uniform float u_speed;
uniform float u_cellCount;
uniform float u_edgeThickness;
uniform float u_distortion;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = uv * vec2(aspect, 1.0) * u_cellCount;
  float t = u_time * u_speed;

  vec3 v = voronoi(p, t);
  float d1 = v.x;
  float d2 = v.y;
  float cellId = v.z;

  // Edge detection
  float edge = d2 - d1;
  float edgeLine = 1.0 - smoothstep(0.0, u_edgeThickness * 0.15, edge);

  // Cell coloring with variation
  float cellHue = fract(cellId * 0.1 + t * 0.05);
  vec3 cellCol = mixOklab(u_cellColor, u_bgColor, cellHue * u_distortion);

  // Combine
  vec3 color = mix(cellCol, u_edgeColor, edgeLine);
  color = clamp(color, 0.0, 1.0);

  // Alpha: blend cell alpha, edge alpha, and bg alpha by their contributions
  float cellAlpha = mix(u_cellColor_alpha, u_bgColor_alpha, cellHue * u_distortion);
  float alpha = mix(cellAlpha, u_edgeColor_alpha, edgeLine);
  fragColor = vec4(color, alpha);
}

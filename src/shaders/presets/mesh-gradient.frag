#version 300 es
precision highp float;

#include "../common/noise-simplex.glsl"
#include "../common/color-oklch.glsl"

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform vec3 u_color1;
uniform float u_color1_alpha;
uniform vec3 u_color2;
uniform float u_color2_alpha;
uniform vec3 u_color3;
uniform float u_color3_alpha;
uniform vec3 u_color4;
uniform float u_color4_alpha;
uniform float u_speed;
uniform float u_complexity;
uniform float u_distortion;
uniform float u_grain;
uniform float u_softness;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 st = vec2(uv.x * aspect, uv.y);

  float t = u_time * u_speed * 0.3;

  // Animated control points on Lissajous curves
  vec2 p1 = vec2(
    0.3 + 0.2 * sin(t * 0.7 + 1.0),
    0.3 + 0.2 * cos(t * 0.5 + 2.0)
  ) * vec2(aspect, 1.0);

  vec2 p2 = vec2(
    0.7 + 0.15 * sin(t * 0.6 + 3.0),
    0.7 + 0.15 * cos(t * 0.8 + 0.5)
  ) * vec2(aspect, 1.0);

  vec2 p3 = vec2(
    0.5 + 0.25 * sin(t * 0.4 + 5.0),
    0.5 + 0.2 * cos(t * 0.9 + 1.5)
  ) * vec2(aspect, 1.0);

  vec2 p4 = vec2(
    0.6 + 0.2 * sin(t * 0.5 + 4.0),
    0.3 + 0.25 * cos(t * 0.7 + 3.0)
  ) * vec2(aspect, 1.0);

  // Noise-based distortion
  vec2 noiseOffset = vec2(
    snoise(st * u_complexity + t * 0.2),
    snoise(st * u_complexity + t * 0.2 + 100.0)
  ) * u_distortion * 0.3;

  vec2 distortedSt = st + noiseOffset;

  // Distances to control points
  float d1 = length(distortedSt - p1);
  float d2 = length(distortedSt - p2);
  float d3 = length(distortedSt - p3);
  float d4 = length(distortedSt - p4);

  // Soft weighted blending
  float soft = u_softness * 2.0 + 0.5;
  float w1 = 1.0 / (pow(d1, soft) + 0.001);
  float w2 = 1.0 / (pow(d2, soft) + 0.001);
  float w3 = 1.0 / (pow(d3, soft) + 0.001);
  float w4 = 1.0 / (pow(d4, soft) + 0.001);
  float wTotal = w1 + w2 + w3 + w4;

  // Mix colors in Oklab space for perceptually uniform blending
  vec3 lab1 = rgb2oklab(u_color1);
  vec3 lab2 = rgb2oklab(u_color2);
  vec3 lab3 = rgb2oklab(u_color3);
  vec3 lab4 = rgb2oklab(u_color4);

  vec3 labMixed = (lab1 * w1 + lab2 * w2 + lab3 * w3 + lab4 * w4) / wTotal;
  vec3 color = oklab2rgb(labMixed);

  // Weighted alpha blend
  float alpha = (u_color1_alpha * w1 + u_color2_alpha * w2 + u_color3_alpha * w3 + u_color4_alpha * w4) / wTotal;

  // Film grain
  if (u_grain > 0.0) {
    float grain = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + u_time) * 43758.5453) - 0.5) * u_grain * 0.15;
    color += grain;
  }

  color = clamp(color, 0.0, 1.0);
  fragColor = vec4(color, alpha);
}

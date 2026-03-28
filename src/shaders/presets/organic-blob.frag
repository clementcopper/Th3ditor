#version 300 es
precision highp float;

#include "../common/noise-simplex.glsl"
#include "../common/color-oklch.glsl"
#include "../common/math-utils.glsl"

uniform float u_time;
uniform vec2 u_resolution;

uniform vec3 u_color1;
uniform float u_color1_alpha;
uniform vec3 u_color2;
uniform float u_color2_alpha;
uniform vec3 u_bgColor;
uniform float u_bgColor_alpha;
uniform float u_speed;
uniform float u_blobCount;
uniform float u_smoothness;
uniform float u_pulseSpeed;
uniform float u_size;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = u_time * u_speed;

  float d = 1e5;

  for (float i = 0.0; i < 6.0; i++) {
    if (i >= u_blobCount) break;

    float angle = TAU * i / u_blobCount + t * 0.3;
    float radius = 0.15 + 0.05 * sin(t * u_pulseSpeed + i * 1.7);
    vec2 center = vec2(cos(angle), sin(angle)) * 0.2;

    // Add noise to position
    center += vec2(
      snoise(vec2(t * 0.5 + i * 3.0, 0.0)),
      snoise(vec2(0.0, t * 0.5 + i * 3.0))
    ) * 0.1;

    float blobDist = length(p - center) - radius * u_size;
    d = smin(d, blobDist, u_smoothness * 0.5);
  }

  // Color by distance
  float edge = smoothstep(0.02, -0.02, d);
  float inner = smoothstep(0.1, -0.1, d);

  float blobMix = inner * 0.7 + 0.15;
  vec3 blobColor = mixOklab(u_color1, u_color2, blobMix);
  float blobAlpha = mix(u_color1_alpha, u_color2_alpha, blobMix);
  vec3 color = mix(u_bgColor, blobColor, edge);

  // Subtle glow
  float glow = exp(-d * 8.0) * 0.3;
  color += mixOklab(u_color1, u_color2, 0.5) * glow;

  color = clamp(color, 0.0, 1.0);
  float fgVisibility = max(edge, glow * 2.0);
  float alpha = mix(u_bgColor_alpha, blobAlpha, fgVisibility);
  fragColor = vec4(color, alpha);
}

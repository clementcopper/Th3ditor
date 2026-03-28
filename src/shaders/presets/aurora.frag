#version 300 es
precision highp float;

#include "../common/noise-simplex.glsl"
#include "../common/color-oklch.glsl"

uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_color1;
uniform float u_color1_alpha;
uniform vec3 u_color2;
uniform float u_color2_alpha;
uniform vec3 u_color3;
uniform float u_color3_alpha;
uniform float u_speed;
uniform float u_ribbonCount;
uniform float u_verticalDrift;
uniform float u_brightness;
uniform float u_fadeEdges;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * u_speed * 0.4;

  vec3 color = vec3(0.0);
  float totalAlpha = 0.0;

  for (float i = 0.0; i < 6.0; i++) {
    if (i >= u_ribbonCount) break;

    float ribbonOffset = i / u_ribbonCount;
    float baseY = 0.3 + ribbonOffset * 0.4;

    // Horizontal flow with noise displacement
    float wave = snoise(vec2(uv.x * 3.0 + t + i * 1.7, t * 0.3 + i * 0.5)) * 0.15;
    wave += snoise(vec2(uv.x * 7.0 - t * 0.5 + i * 2.3, t * 0.2)) * 0.08;
    wave *= u_verticalDrift;

    float y = baseY + wave;
    float dist = abs(uv.y - y);

    // Ribbon intensity
    float ribbonWidth = 0.04 + 0.02 * sin(t + i * 2.0);
    float intensity = smoothstep(ribbonWidth, 0.0, dist);
    intensity *= u_brightness;

    // Shimmer
    float shimmer = snoise(vec2(uv.x * 20.0 + t * 2.0, uv.y * 10.0 + i * 5.0));
    intensity *= 0.7 + 0.3 * shimmer;

    // Color selection per ribbon
    float colorMix = fract(ribbonOffset * 1.5 + t * 0.1);
    vec3 ribbonColor;
    float ribbonAlpha;
    if (colorMix < 0.5) {
      float t2 = colorMix * 2.0;
      ribbonColor = mixOklab(u_color1, u_color2, t2);
      ribbonAlpha = mix(u_color1_alpha, u_color2_alpha, t2);
    } else {
      float t2 = (colorMix - 0.5) * 2.0;
      ribbonColor = mixOklab(u_color2, u_color3, t2);
      ribbonAlpha = mix(u_color2_alpha, u_color3_alpha, t2);
    }

    color += ribbonColor * intensity * ribbonAlpha;
    totalAlpha += intensity * ribbonAlpha;
  }

  // Edge fade
  float edgeFade = 1.0;
  if (u_fadeEdges > 0.0) {
    edgeFade *= smoothstep(0.0, u_fadeEdges * 0.3, uv.x);
    edgeFade *= smoothstep(0.0, u_fadeEdges * 0.3, 1.0 - uv.x);
    edgeFade *= smoothstep(0.0, u_fadeEdges * 0.2, uv.y);
    edgeFade *= smoothstep(0.0, u_fadeEdges * 0.2, 1.0 - uv.y);
  }

  color *= edgeFade;
  color = clamp(color, 0.0, 1.0);
  float alpha = clamp(totalAlpha, 0.0, 1.0);
  fragColor = vec4(color, alpha);
}

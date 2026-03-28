#version 300 es
precision highp float;

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
uniform float u_waveCount;
uniform float u_frequency;
uniform float u_amplitude;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = u_time * u_speed;

  float totalWave = 0.0;

  for (float i = 0.0; i < 8.0; i++) {
    if (i >= u_waveCount) break;

    float angle = TAU * i / u_waveCount + t * 0.2;
    vec2 center = vec2(cos(angle), sin(angle)) * 0.3;

    float dist = length(p - center);
    float wave = sin(dist * u_frequency - t * 2.0) * u_amplitude;
    totalWave += wave;
  }

  totalWave /= u_waveCount;
  float norm = totalWave * 0.5 + 0.5;

  float fgAmount = smoothstep(-0.1, 0.1, abs(totalWave));
  vec3 color = mixOklab(u_color1, u_color2, norm);
  float fgAlpha = mix(u_color1_alpha, u_color2_alpha, norm);
  color = mixOklab(u_bgColor, color, fgAmount);

  color = clamp(color, 0.0, 1.0);
  float alpha = mix(u_bgColor_alpha, fgAlpha, fgAmount);
  fragColor = vec4(color, alpha);
}

#version 300 es
precision highp float;

#include "../common/noise-simplex.glsl"
#include "../common/color-oklch.glsl"

uniform float u_time;
uniform vec2 u_resolution;

uniform vec3 u_lineColor;
uniform float u_lineColor_alpha;
uniform vec3 u_bgColor;
uniform float u_bgColor_alpha;
uniform float u_speed;
uniform float u_noiseScale;
uniform float u_flowSpeed;
uniform float u_density;
uniform float u_curl;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = uv * vec2(aspect, 1.0);
  float t = u_time * u_speed * 0.5;

  vec3 color = u_bgColor;
  float totalIntensity = 0.0;

  // Multiple flow layers
  for (float layer = 0.0; layer < 4.0; layer++) {
    vec2 lp = p * u_noiseScale * (1.0 + layer * 0.3);
    float layerOffset = layer * 7.0;

    // Advect through flow field
    vec2 pos = lp;
    float intensity = 0.0;

    for (float step = 0.0; step < 20.0; step++) {
      // Curl noise direction
      float eps = 0.01;
      float n = snoise(pos + vec2(0.0, 0.0) + t + layerOffset);
      float nx = snoise(pos + vec2(eps, 0.0) + t + layerOffset);
      float ny = snoise(pos + vec2(0.0, eps) + t + layerOffset);

      // Curl = (dN/dy, -dN/dx)
      vec2 curl = vec2(ny - n, -(nx - n)) / eps * u_curl;

      pos += curl * 0.01 * u_flowSpeed;

      // Accumulate trail
      vec2 diff = pos - lp;
      float dist = length(diff);
      intensity += exp(-dist * u_density * 10.0) * 0.05;
    }

    float layerAlpha = intensity * (1.0 - layer * 0.2);
    vec3 layerColor = mixOklab(u_lineColor, u_bgColor, layer / 4.0 * 0.5);
    color = mix(color, layerColor, min(layerAlpha, 1.0));
    totalIntensity += intensity;
  }

  color = clamp(color, 0.0, 1.0);
  float alpha = mix(u_bgColor_alpha, u_lineColor_alpha, clamp(totalIntensity, 0.0, 1.0));
  fragColor = vec4(color, alpha);
}

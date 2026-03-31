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
uniform float u_gridSize;
uniform float u_dotMin;
uniform float u_dotMax;
uniform float u_modulationType;
uniform float u_frequency;
uniform float u_dotShape;
uniform float u_rotation;
uniform float u_spacing;
uniform float u_interactMode;
uniform float u_interactStrength;
uniform float u_interactRadius;
uniform float u_interactFalloff;

out vec4 fragColor;

// Rotate 2D point
vec2 rot2d(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c*p.x - s*p.y, s*p.x + c*p.y);
}

// Distance function for dot shape
float dotDist(vec2 f, float shape) {
  if (shape < 0.5) return length(f);               // Circle
  if (shape < 1.5) return max(abs(f.x), abs(f.y)); // Square
  return abs(f.x) + abs(f.y);                       // Diamond
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = u_time * u_speed;

  // Rotate grid (u_rotation is in degrees)
  p = rot2d(p, radians(u_rotation));
  p += 0.5 * vec2(aspect, 1.0); // shift back for grid calc

  // Grid — spacing scales the cell size relative to grid count
  float effGrid = u_gridSize / u_spacing;
  vec2 cell = floor(p * effGrid);
  vec2 f = fract(p * effGrid) - 0.5;
  vec2 cellCenter = (cell + 0.5) / effGrid;

  float freq = u_frequency;

  // Modulation value (0-1)
  float modValue;
  if (u_modulationType < 0.5) {
    // Noise
    modValue = snoise(cell * 0.3 * freq * 0.3 + t * 0.5) * 0.5 + 0.5;
  } else if (u_modulationType < 1.5) {
    // Radial
    vec2 center = vec2(aspect * 0.5, 0.5);
    float dist = length(cellCenter - center);
    modValue = sin(dist * freq * 3.0 - t * 2.0) * 0.5 + 0.5;
  } else if (u_modulationType < 2.5) {
    // Wave
    modValue = sin(cellCenter.x * freq * 2.5 + t) * sin(cellCenter.y * freq * 2.5 + t * 0.7) * 0.5 + 0.5;
  } else if (u_modulationType < 3.5) {
    // Checker
    float cx = mod(cell.x, 2.0);
    float cy = mod(cell.y, 2.0);
    float checker = mod(cx + cy, 2.0);
    modValue = mix(0.2, 0.9, checker) + sin(t) * 0.1;
  } else if (u_modulationType < 4.5) {
    // Spiral
    vec2 center = vec2(aspect * 0.5, 0.5);
    vec2 d = cellCenter - center;
    float angle = atan(d.y, d.x);
    float dist = length(d);
    modValue = sin(angle * freq + dist * freq * 5.0 - t * 2.0) * 0.5 + 0.5;
  } else if (u_modulationType < 5.5) {
    // Scanline
    float scanPos = fract(t * 0.3) * (1.0 + 0.3); // travels top to bottom + overshoot
    float dist = abs(cellCenter.y - scanPos);
    modValue = exp(-dist * freq * 3.0);
  } else if (u_modulationType < 6.5) {
    // Gradient
    float angle = freq * 0.5;
    float grad = dot(cellCenter, vec2(cos(angle), sin(angle)));
    modValue = fract(grad * 2.0 + t * 0.2);
  } else {
    // Pulse — expanding ring from center
    vec2 center = vec2(aspect * 0.5, 0.5);
    float dist = length(cellCenter - center);
    float cycle = fract(t * 0.5);
    float ring = cycle * 1.5;
    modValue = exp(-freq * 2.0 * (dist - ring) * (dist - ring)) * (1.0 - cycle);
  }

  modValue = clamp(modValue, 0.0, 1.0);

  // Interaction
  float interactOffset = 0.0;
  vec2 posOffset = vec2(0.0);

  if (u_interactMode > 0.5) {
    vec2 mp = (u_mouse - 0.5) * vec2(aspect, 1.0);
    mp = rot2d(mp, radians(u_rotation));
    mp += 0.5 * vec2(aspect, 1.0);
    float md = length(cellCenter - mp);
    float raw = smoothstep(u_interactRadius, 0.0, md);
    float influence = pow(raw, u_interactFalloff) * u_interactStrength;

    if (u_interactMode < 1.5) {
      // Attractor — dots grow near cursor
      interactOffset = influence;
    } else if (u_interactMode < 2.5) {
      // Repel — dots shrink near cursor
      interactOffset = -influence;
    } else if (u_interactMode < 3.5) {
      // Magnet — dots shift toward cursor in cell-space
      vec2 dir = (md > 0.001) ? normalize(mp - cellCenter) : vec2(0.0);
      posOffset = dir * influence * 0.4;
    } else {
      // Spotlight — only dots near cursor are visible
      modValue *= influence;
    }
  }

  // Apply interaction to modulation
  modValue = clamp(modValue + interactOffset, 0.0, 1.0);

  // Dot radius — scale with spacing so dots stay round
  float radius = mix(u_dotMin, u_dotMax, modValue) * 0.45 * min(u_spacing, 1.0);

  // Limit magnet offset so dot stays fully inside its cell
  float maxShift = max(0.48 - radius, 0.0);
  float oLen = length(posOffset);
  if (oLen > maxShift && oLen > 0.001) {
    posOffset = posOffset / oLen * maxShift;
  }
  vec2 dotPos = f - posOffset;

  // Shape distance
  float d = dotDist(dotPos, u_dotShape);
  float dot = smoothstep(radius, radius - 0.02, d);

  // Color: blend dot color → highlight by modulation
  vec3 dotCol = mixOklab(u_dotColor, u_highlightColor, modValue);
  float dotAlpha = mix(u_dotColor_alpha, u_highlightColor_alpha, modValue);
  vec3 color = mix(u_bgColor, dotCol, dot);

  color = clamp(color, 0.0, 1.0);
  float alpha = mix(u_bgColor_alpha, dotAlpha, dot);
  fragColor = vec4(color, alpha);
}

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
uniform float u_frequency;
uniform float u_decay;
uniform float u_perspective;
uniform float u_rotateX;
uniform float u_rotateY;
uniform float u_posX;
uniform float u_posY;
uniform float u_scale;
uniform float u_shapeType;
uniform float u_deformType;
uniform int u_deformOutward;
uniform float u_interactMode;
uniform float u_interactStrength;
uniform float u_interactRadius;
uniform float u_interactFalloff;
uniform float u_renderMode;
uniform float u_lineSegments;

out vec4 fragColor;

// Shared rotation values — set in main()
float _cosRY, _sinRY, _cosRX, _sinRX;
float _gs, _tp, _t;

float pc_deform(vec3 p, float t) {
  float freq = u_frequency;
  float dec = u_decay;
  if (u_deformType < 0.5) return 0.0;
  if (u_deformType < 1.5) return sin(p.x*freq+t*2.0)*cos(p.z*freq+t*1.5)*u_amplitude;
  if (u_deformType < 2.5) return fbm(p.xz*freq*0.7+t*0.3, 4, 2.0, 0.5)*u_amplitude;
  if (u_deformType < 3.5) return sin(p.y*freq+t+length(p.xz)*freq*1.3)*u_amplitude*0.5;
  if (u_deformType < 4.5) {
    float r = length(p.xz);
    return sin(r*freq*2.5 - t*3.0) * u_amplitude * 0.5 * exp(-r*dec);
  }
  if (u_deformType < 5.5) {
    float squeeze = sin(p.y * PI * freq * 0.3 + t) * u_amplitude;
    return -length(p.xz) * squeeze;
  }
  if (u_deformType < 6.5) {
    float n = snoise(p.xz * freq * 0.7 + t * 0.5);
    float d = length(p);
    return (d + n * 0.5) * u_amplitude * (0.5 + 0.5 * sin(t * 1.5));
  }
  if (u_deformType < 7.5) {
    float d = length(p);
    float cycle = fract(t * 0.8);
    float ring = cycle * 3.0;
    float sharpness = freq * 1.3;
    float wave = exp(-sharpness * (d - ring) * (d - ring));
    float fade = exp(-cycle * dec * 3.0);
    return wave * fade * u_amplitude;
  }
  return sin(t * freq * 0.7) * u_amplitude * 0.3;
}

// Project a grid point to screen space
// cols = number of columns, rows = number of rows
// Returns vec4: xy = screen pos, z = depth, w = deform value
vec4 projectPoint(float ix, float iy, float cols, float rows) {
  float nu = ix / max(cols - 1.0, 1.0);
  float nv = iy / max(rows - 1.0, 1.0);

  vec3 bp;
  if (u_shapeType > 1.5) {
    float idx = iy * _gs + ix;
    float ga = PI * (3.0 - sqrt(5.0));
    float y = 1.0 - (2.0 * idx + 1.0) / _tp;
    float r = sqrt(1.0 - y * y);
    bp = vec3(r * cos(ga * idx), y, r * sin(ga * idx));
  } else if (u_shapeType > 0.5) {
    float th = nu * PI, ph = nv * TAU;
    bp = vec3(sin(th)*cos(ph), cos(th), sin(th)*sin(ph));
  } else {
    bp = vec3((nu - 0.5) * 2.0, 0.0, (nv - 0.5) * 2.0);
  }

  float def = pc_deform(bp, _t);
  vec3 gp;
  if (u_shapeType < 0.5) {
    gp = vec3(bp.x, def, bp.z);
  } else {
    float d = (u_deformOutward == 1) ? max(def, 0.0) : def;
    gp = bp * (1.0 + d);
  }
  gp *= u_scale;

  vec3 r1 = vec3(_cosRY*gp.x + _sinRY*gp.z, gp.y, -_sinRY*gp.x + _cosRY*gp.z);
  vec3 pos = vec3(r1.x, _cosRX*r1.y - _sinRX*r1.z, _sinRX*r1.y + _cosRX*r1.z);
  pos.x += u_posX;
  pos.y += u_posY;

  float depth = u_perspective + pos.z;
  vec2 scr = pos.xy / max(depth, 0.1);

  float hv = (u_deformType < 0.5 && u_shapeType > 0.5) ? bp.y : def;
  return vec4(scr, depth, hv);
}

// Apply interaction offset to a screen position
vec2 applyInteraction(vec2 scr) {
  if (u_interactMode < 0.5) return scr;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 mc = (u_mouse - 0.5) * vec2(aspect, 1.0);
  vec2 toMouse = mc - scr;
  float md = length(toMouse);
  float raw = smoothstep(u_interactRadius, 0.0, md);
  float influence = pow(raw, u_interactFalloff) * u_interactStrength * 0.15;
  vec2 dir = (md > 0.001) ? normalize(toMouse) : vec2(0.0);
  if (u_interactMode < 1.5) {
    return scr + dir * influence;
  } else {
    return scr - dir * influence;
  }
}

// Distance from point p to line segment a-b
float segmentDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float len2 = dot(ab, ab);
  if (len2 < 0.000001) return length(p - a);
  float t = clamp(dot(p - a, ab) / len2, 0.0, 1.0);
  return length(p - (a + t * ab));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 centered = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  _t = u_time * u_speed;

  vec3 color = u_bgColor;
  float totalDot = 0.0;

  _gs = u_gridDensity;
  _tp = _gs * _gs;
  _cosRY = cos(radians(u_rotateY)); _sinRY = sin(radians(u_rotateY));
  _cosRX = cos(radians(u_rotateX)); _sinRX = sin(radians(u_rotateX));

  bool lineMode = u_renderMode > 0.5;
  float cols = _gs;                                    // number of lines/columns
  float rows = lineMode ? u_lineSegments : _gs;        // points per line

  for (float iy = 0.0; iy < 60.0; iy++) {
    if (iy >= rows) break;
    for (float ix = 0.0; ix < 30.0; ix++) {
      if (ix >= cols) break;

      vec4 pt = projectPoint(ix, iy, cols, rows);
      if (pt.z < 0.1) continue;

      vec2 scr = applyInteraction(pt.xy);
      float depth = pt.z;
      float hv = pt.w;

      if (lineMode && iy + 1.0 < rows) {
        // Lines: draw segment to next point in column
        vec4 ptNext = projectPoint(ix, iy + 1.0, cols, rows);
        if (ptNext.z >= 0.1) {
          vec2 scrNext = applyInteraction(ptNext.xy);
          float avgDepth = (depth + ptNext.z) * 0.5;
          float lineR = u_dotSize * 0.005 / avgDepth;
          float lineFade = 2.0 / (avgDepth * avgDepth);
          float sd = segmentDist(centered, scr, scrNext);
          float line = smoothstep(lineR, lineR * 0.2, sd) * lineFade;

          float hn = hv / max(u_amplitude, 0.01) * 0.5 + 0.5;
          vec3 dotCol = mixOklab(u_dotColor, u_highlightColor, hn);
          float dotAlpha = mix(u_dotColor_alpha, u_highlightColor_alpha, hn);

          color = mix(color, dotCol, min(line, 1.0));
          totalDot += line * dotAlpha;
        }
      } else if (!lineMode) {
        // Points: draw dot
        float d = length(centered - scr);
        float dotR = u_dotSize * 0.008 / depth;
        float depthFade = 2.0 / (depth * depth);
        float dot = smoothstep(dotR, dotR * 0.3, d) * depthFade;

        float hn = hv / max(u_amplitude, 0.01) * 0.5 + 0.5;
        vec3 dotCol = mixOklab(u_dotColor, u_highlightColor, hn);
        float dotAlpha = mix(u_dotColor_alpha, u_highlightColor_alpha, hn);

        color = mix(color, dotCol, min(dot, 1.0));
        totalDot += dot * dotAlpha;
      }
    }
  }

  color = clamp(color, 0.0, 1.0);
  float alpha = mix(u_bgColor_alpha, 1.0, clamp(totalDot, 0.0, 1.0));
  fragColor = vec4(color, alpha);
}

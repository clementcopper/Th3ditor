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
  float t = u_time * u_speed;

  vec3 color = u_bgColor;
  float totalDot = 0.0;

  float gs = u_gridDensity;
  float tp = gs * gs;
  float cosRY = cos(radians(u_rotateY)), sinRY = sin(radians(u_rotateY));
  float cosRX = cos(radians(u_rotateX)), sinRX = sin(radians(u_rotateX));

  bool lineMode = u_renderMode > 0.5;
  float cols = gs;
  float rows = lineMode ? u_lineSegments : gs;
  float aspect = u_resolution.x / u_resolution.y;

  for (float iy = 0.0; iy < 60.0; iy++) {
    if (iy >= rows) break;
    for (float ix = 0.0; ix < 30.0; ix++) {
      if (ix >= cols) break;

      float nu = ix / max(cols - 1.0, 1.0);
      float nv = iy / max(rows - 1.0, 1.0);

      // Base shape
      vec3 bp;
      if (u_shapeType > 1.5) {
        float idx = iy * gs + ix;
        float ga = PI * (3.0 - sqrt(5.0));
        float y = 1.0 - (2.0 * idx + 1.0) / tp;
        float r = sqrt(1.0 - y * y);
        bp = vec3(r * cos(ga * idx), y, r * sin(ga * idx));
      } else if (u_shapeType > 0.5) {
        float th = nu * PI, ph = nv * TAU;
        bp = vec3(sin(th)*cos(ph), cos(th), sin(th)*sin(ph));
      } else {
        bp = vec3((nu - 0.5) * 2.0, 0.0, (nv - 0.5) * 2.0);
      }

      // Deform
      float def = pc_deform(bp, t);
      vec3 gp;
      if (u_shapeType < 0.5) {
        gp = vec3(bp.x, def, bp.z);
      } else {
        float d = (u_deformOutward == 1) ? max(def, 0.0) : def;
        gp = bp * (1.0 + d);
      }
      gp *= u_scale;

      // Rotate Y then X
      vec3 r1 = vec3(cosRY*gp.x + sinRY*gp.z, gp.y, -sinRY*gp.x + cosRY*gp.z);
      vec3 pos = vec3(r1.x, cosRX*r1.y - sinRX*r1.z, sinRX*r1.y + cosRX*r1.z);
      pos.x += u_posX;
      pos.y += u_posY;

      float depth = u_perspective + pos.z;
      if (depth < 0.1) continue;
      vec2 scr = pos.xy / depth;

      // Interaction
      if (u_interactMode > 0.5) {
        vec2 mc = (u_mouse - 0.5) * vec2(aspect, 1.0);
        vec2 toMouse = mc - scr;
        float md = length(toMouse);
        float raw = smoothstep(u_interactRadius, 0.0, md);
        float influence = pow(raw, u_interactFalloff) * u_interactStrength * 0.15;
        vec2 dir = (md > 0.001) ? normalize(toMouse) : vec2(0.0);
        if (u_interactMode < 1.5) {
          scr += dir * influence;
        } else {
          scr -= dir * influence;
        }
      }

      float hv = (u_deformType < 0.5 && u_shapeType > 0.5) ? bp.y : def;
      float hn = hv / max(u_amplitude, 0.01) * 0.5 + 0.5;
      vec3 dotCol = mixOklab(u_dotColor, u_highlightColor, hn);
      float dotAlpha = mix(u_dotColor_alpha, u_highlightColor_alpha, hn);

      if (lineMode && iy + 1.0 < rows) {
        // Lines: compute next point and draw segment
        float nvNext = (iy + 1.0) / max(rows - 1.0, 1.0);

        vec3 bpN;
        if (u_shapeType > 1.5) {
          float idx = (iy + 1.0) * gs + ix;
          float ga = PI * (3.0 - sqrt(5.0));
          float y = 1.0 - (2.0 * idx + 1.0) / tp;
          float r = sqrt(1.0 - y * y);
          bpN = vec3(r * cos(ga * idx), y, r * sin(ga * idx));
        } else if (u_shapeType > 0.5) {
          float th = nu * PI, ph = nvNext * TAU;
          bpN = vec3(sin(th)*cos(ph), cos(th), sin(th)*sin(ph));
        } else {
          bpN = vec3((nu - 0.5) * 2.0, 0.0, (nvNext - 0.5) * 2.0);
        }

        float defN = pc_deform(bpN, t);
        vec3 gpN;
        if (u_shapeType < 0.5) {
          gpN = vec3(bpN.x, defN, bpN.z);
        } else {
          float d = (u_deformOutward == 1) ? max(defN, 0.0) : defN;
          gpN = bpN * (1.0 + d);
        }
        gpN *= u_scale;

        vec3 r1N = vec3(cosRY*gpN.x + sinRY*gpN.z, gpN.y, -sinRY*gpN.x + cosRY*gpN.z);
        vec3 posN = vec3(r1N.x, cosRX*r1N.y - sinRX*r1N.z, sinRX*r1N.y + cosRX*r1N.z);
        posN.x += u_posX;
        posN.y += u_posY;

        float depthN = u_perspective + posN.z;
        if (depthN >= 0.1) {
          vec2 scrN = posN.xy / depthN;

          if (u_interactMode > 0.5) {
            vec2 mc = (u_mouse - 0.5) * vec2(aspect, 1.0);
            vec2 toMouse = mc - scrN;
            float md = length(toMouse);
            float raw = smoothstep(u_interactRadius, 0.0, md);
            float influence = pow(raw, u_interactFalloff) * u_interactStrength * 0.15;
            vec2 dir = (md > 0.001) ? normalize(toMouse) : vec2(0.0);
            if (u_interactMode < 1.5) { scrN += dir * influence; }
            else { scrN -= dir * influence; }
          }

          float avgDepth = (depth + depthN) * 0.5;
          float lineR = u_dotSize * 0.005 / avgDepth;
          float lineFade = 2.0 / (avgDepth * avgDepth);
          float sd = segmentDist(centered, scr, scrN);
          float line = smoothstep(lineR, lineR * 0.2, sd) * lineFade;

          color = mix(color, dotCol, min(line, 1.0));
          totalDot += line * dotAlpha;
        }
      } else if (!lineMode) {
        // Points: draw dot
        float dist = length(centered - scr);
        float dotR = u_dotSize * 0.008 / depth;
        float depthFade = 2.0 / (depth * depth);
        float dot = smoothstep(dotR, dotR * 0.3, dist) * depthFade;

        color = mix(color, dotCol, min(dot, 1.0));
        totalDot += dot * dotAlpha;
      }
    }
  }

  color = clamp(color, 0.0, 1.0);
  float alpha = mix(u_bgColor_alpha, 1.0, clamp(totalDot, 0.0, 1.0));
  fragColor = vec4(color, alpha);
}

// OKLCH / Oklab color space conversions
// Based on Björn Ottosson's Oklab: https://bottosson.github.io/posts/oklab/

vec3 rgb2oklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;

  float l_ = pow(l, 1.0 / 3.0);
  float m_ = pow(m, 1.0 / 3.0);
  float s_ = pow(s, 1.0 / 3.0);

  return vec3(
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  );
}

vec3 oklab2rgb(vec3 lab) {
  float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;

  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;

  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 rgb2oklch(vec3 rgb) {
  vec3 lab = rgb2oklab(rgb);
  float L = lab.x;
  float C = length(lab.yz);
  float H = atan(lab.z, lab.y);
  return vec3(L, C, H);
}

vec3 oklch2rgb(vec3 lch) {
  float a = lch.y * cos(lch.z);
  float b = lch.y * sin(lch.z);
  return oklab2rgb(vec3(lch.x, a, b));
}

// Perceptually uniform color mixing in Oklab space
vec3 mixOklab(vec3 rgb1, vec3 rgb2, float t) {
  vec3 lab1 = rgb2oklab(rgb1);
  vec3 lab2 = rgb2oklab(rgb2);
  return oklab2rgb(mix(lab1, lab2, t));
}

// Mix in OKLCH space (preserves hue path)
vec3 mixOklch(vec3 rgb1, vec3 rgb2, float t) {
  vec3 lch1 = rgb2oklch(rgb1);
  vec3 lch2 = rgb2oklch(rgb2);

  // Handle hue interpolation (shortest path)
  float h1 = lch1.z;
  float h2 = lch2.z;
  float dh = h2 - h1;
  if (dh > 3.14159265) dh -= 6.28318530;
  if (dh < -3.14159265) dh += 6.28318530;

  vec3 lch = vec3(
    mix(lch1.x, lch2.x, t),
    mix(lch1.y, lch2.y, t),
    h1 + dh * t
  );

  return oklch2rgb(lch);
}

use wasm_bindgen::prelude::*;
use js_sys::Float32Array;

/// CPU-based 2D simplex noise precomputation.
///
/// Generates a flat Float32Array of RGBA values (4 channels per pixel)
/// that can be uploaded as a WebGL2 texture when compute shaders are not available.
///
/// Channels:
///   R = snoise at base frequency
///   G = fbm (4 octaves)
///   B = snoise at 2x frequency (detail layer)
///   A = 1.0
///
/// This is the CPU fallback for `noise-texture.wgsl` compute shader.
#[wasm_bindgen]
pub fn generate_noise_texture(
    width: u32,
    height: u32,
    scale: f32,
    offset_x: f32,
    offset_y: f32,
) -> Float32Array {
    let size = (width * height * 4) as usize;
    let mut data = vec![0.0f32; size];

    for y in 0..height {
        for x in 0..width {
            let u = x as f32 / width as f32;
            let v = y as f32 / height as f32;
            let px = u * scale + offset_x;
            let py = v * scale + offset_y;

            let noise_base = snoise2d(px, py) * 0.5 + 0.5;
            let noise_fbm = fbm(px, py, 4, 2.0, 0.5) * 0.5 + 0.5;
            let noise_detail = snoise2d(px * 2.0, py * 2.0) * 0.5 + 0.5;

            let idx = ((y * width + x) * 4) as usize;
            data[idx] = noise_base;
            data[idx + 1] = noise_fbm;
            data[idx + 2] = noise_detail;
            data[idx + 3] = 1.0;
        }
    }

    // Zero-copy transfer to JS
    let array = Float32Array::new_with_length(size as u32);
    array.copy_from(&data);
    array
}

// --- Simplex noise implementation (2D) ---

fn mod289(x: f32) -> f32 {
    x - (x * (1.0 / 289.0)).floor() * 289.0
}

fn permute(x: f32) -> f32 {
    mod289(((x * 34.0) + 10.0) * x)
}

/// 2D simplex noise, ported from the GLSL implementation
fn snoise2d(vx: f32, vy: f32) -> f32 {
    let c1 = 0.211324865405187;  // (3.0 - sqrt(3.0)) / 6.0
    let c2 = 0.366025403784439;  // 0.5 * (sqrt(3.0) - 1.0)
    let c3 = -0.577350269189626; // -1.0 + 2.0 * c1
    let c4 = 0.024390243902439;  // 1.0 / 41.0

    // Skew the input space
    let s = (vx + vy) * c2;
    let ix = (vx + s).floor();
    let iy = (vy + s).floor();

    let t = (ix + iy) * c1;
    let x0x = vx - ix + t;
    let x0y = vy - iy + t;

    // Determine which simplex we're in
    let (i1x, i1y) = if x0x > x0y { (1.0, 0.0) } else { (0.0, 1.0) };

    let x12x = x0x + c1 - i1x;
    let x12y = x0y + c1 - i1y;
    let x12z = x0x + c3;
    let x12w = x0y + c3;

    let imx = mod289(ix);
    let imy = mod289(iy);

    let p0 = permute(permute(imy) + imx);
    let p1 = permute(permute(imy + i1y) + imx + i1x);
    let p2 = permute(permute(imy + 1.0) + imx + 1.0);

    let mut m0 = (0.5 - (x0x * x0x + x0y * x0y)).max(0.0);
    let mut m1 = (0.5 - (x12x * x12x + x12y * x12y)).max(0.0);
    let mut m2 = (0.5 - (x12z * x12z + x12w * x12w)).max(0.0);

    m0 = m0 * m0; m0 = m0 * m0;
    m1 = m1 * m1; m1 = m1 * m1;
    m2 = m2 * m2; m2 = m2 * m2;

    let x0 = 2.0 * (p0 * c4).fract() - 1.0;
    let x1 = 2.0 * (p1 * c4).fract() - 1.0;
    let x2 = 2.0 * (p2 * c4).fract() - 1.0;

    let h0 = x0.abs() - 0.5;
    let h1 = x1.abs() - 0.5;
    let h2 = x2.abs() - 0.5;

    let ox0 = (x0 + 0.5).floor();
    let ox1 = (x1 + 0.5).floor();
    let ox2 = (x2 + 0.5).floor();

    let a0 = x0 - ox0;
    let a1 = x1 - ox1;
    let a2 = x2 - ox2;

    m0 *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h0 * h0);
    m1 *= 1.79284291400159 - 0.85373472095314 * (a1 * a1 + h1 * h1);
    m2 *= 1.79284291400159 - 0.85373472095314 * (a2 * a2 + h2 * h2);

    let g0 = a0 * x0x + h0 * x0y;
    let g1 = a1 * x12x + h1 * x12y;
    let g2 = a2 * x12z + h2 * x12w;

    130.0 * (m0 * g0 + m1 * g1 + m2 * g2)
}

/// Fractional Brownian Motion using simplex noise
fn fbm(px: f32, py: f32, octaves: u32, lacunarity: f32, persistence: f32) -> f32 {
    let mut value = 0.0;
    let mut amplitude = 0.5;
    let mut frequency = 1.0;
    for _ in 0..octaves {
        value += amplitude * snoise2d(px * frequency, py * frequency);
        frequency *= lacunarity;
        amplitude *= persistence;
    }
    value
}

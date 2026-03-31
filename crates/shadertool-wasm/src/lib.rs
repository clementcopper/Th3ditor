use wasm_bindgen::prelude::*;
use serde::Serialize;

mod noise;
mod validate;

// Re-export public API
pub use noise::generate_noise_texture;
pub use validate::validate_wgsl;

/// Initialize panic hook for better error messages in browser console
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

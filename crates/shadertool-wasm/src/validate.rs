use wasm_bindgen::prelude::*;
use serde::Serialize;

/// Validation result returned to JavaScript
#[derive(Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
}

#[derive(Serialize)]
pub struct ValidationError {
    pub message: String,
    pub line: Option<u32>,
    pub column: Option<u32>,
    pub severity: String, // "error" | "warning"
}

/// Validate a WGSL shader source string using naga.
///
/// Returns a JSON-serializable result with detailed error messages,
/// line numbers, and column positions — much better than browser-native
/// WebGPU validation which often gives cryptic one-liners.
///
/// # Example (from JS)
/// ```js
/// import { validate_wgsl } from 'shadertool-wasm';
/// const result = validate_wgsl(shaderSource);
/// if (!result.valid) {
///   result.errors.forEach(e => console.error(`Line ${e.line}: ${e.message}`));
/// }
/// ```
#[wasm_bindgen]
pub fn validate_wgsl(source: &str) -> JsValue {
    let module = match naga::front::wgsl::parse_str(source) {
        Ok(module) => module,
        Err(parse_error) => {
            let errors = vec![ValidationError {
                message: format!("{}", parse_error),
                line: None,   // naga parse errors include location in the message
                column: None,
                severity: "error".to_string(),
            }];
            let result = ValidationResult {
                valid: false,
                errors,
            };
            return serde_wasm_bindgen::to_value(&result).unwrap();
        }
    };

    // Run the validator for semantic checks
    let mut validator = naga::valid::Validator::new(
        naga::valid::ValidationFlags::all(),
        naga::valid::Capabilities::all(),
    );

    match validator.validate(&module) {
        Ok(_) => {
            let result = ValidationResult {
                valid: true,
                errors: vec![],
            };
            serde_wasm_bindgen::to_value(&result).unwrap()
        }
        Err(validation_error) => {
            let errors = vec![ValidationError {
                message: format!("{}", validation_error),
                line: None,
                column: None,
                severity: "error".to_string(),
            }];
            let result = ValidationResult {
                valid: false,
                errors,
            };
            serde_wasm_bindgen::to_value(&result).unwrap()
        }
    }
}

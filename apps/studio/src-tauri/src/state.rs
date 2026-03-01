use std::sync::Mutex;

use crate::platform::trait_defs::PlatformOps;

/// Managed Tauri state wrapping the platform implementation.
pub struct AppState {
    pub platform: Mutex<Box<dyn PlatformOps + Send>>,
}

impl AppState {
    pub fn new(platform: Box<dyn PlatformOps + Send>) -> Self {
        Self {
            platform: Mutex::new(platform),
        }
    }
}

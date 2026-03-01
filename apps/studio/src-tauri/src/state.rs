use std::sync::Mutex;

use revvault_core::PassageStore;

use crate::platform::trait_defs::PlatformOps;

/// Managed Tauri state wrapping the platform implementation and vault store.
pub struct AppState {
    pub platform: Mutex<Box<dyn PlatformOps + Send>>,
    pub vault: Mutex<Option<PassageStore>>,
}

impl AppState {
    pub fn new(platform: Box<dyn PlatformOps + Send>) -> Self {
        Self {
            platform: Mutex::new(platform),
            vault: Mutex::new(None),
        }
    }
}

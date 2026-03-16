use tauri::State;

use super::error::StudioError;
use crate::platform::trait_defs::{MountStatus, SystemStatus};
use crate::state::AppState;

#[tauri::command]
pub fn get_system_status(state: State<AppState>) -> Result<SystemStatus, StudioError> {
    let platform = state
        .platform
        .lock()
        .map_err(|e| StudioError::LockPoisoned(e.to_string()))?;
    platform.get_system_status().map_err(|e| StudioError::Other(e))
}

#[tauri::command]
pub fn get_mount_status(state: State<AppState>) -> Result<MountStatus, StudioError> {
    let platform = state
        .platform
        .lock()
        .map_err(|e| StudioError::LockPoisoned(e.to_string()))?;
    platform.get_mount_status().map_err(|e| StudioError::Other(e))
}

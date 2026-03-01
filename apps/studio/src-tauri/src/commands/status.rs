use tauri::State;

use crate::platform::trait_defs::{MountStatus, SystemStatus};
use crate::state::AppState;

#[tauri::command]
pub fn get_system_status(state: State<AppState>) -> Result<SystemStatus, String> {
    let platform = state.platform.lock().map_err(|e| e.to_string())?;
    platform.get_system_status()
}

#[tauri::command]
pub fn get_mount_status(state: State<AppState>) -> Result<MountStatus, String> {
    let platform = state.platform.lock().map_err(|e| e.to_string())?;
    platform.get_mount_status()
}

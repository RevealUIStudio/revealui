use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub fn mount_devbox(state: State<AppState>) -> Result<String, String> {
    let platform = state.platform.lock().map_err(|e| e.to_string())?;
    platform.mount_devbox()
}

#[tauri::command]
pub fn unmount_devbox(state: State<AppState>) -> Result<String, String> {
    let platform = state.platform.lock().map_err(|e| e.to_string())?;
    platform.unmount_devbox()
}

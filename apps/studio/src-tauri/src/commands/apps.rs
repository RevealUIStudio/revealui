use tauri::State;

use crate::platform::trait_defs::AppStatus;
use crate::state::AppState;

#[tauri::command]
pub fn list_apps(state: State<AppState>) -> Result<Vec<AppStatus>, String> {
    let platform = state.platform.lock().map_err(|e| e.to_string())?;
    platform.list_apps()
}

#[tauri::command]
pub fn start_app(state: State<AppState>, name: String) -> Result<String, String> {
    let platform = state.platform.lock().map_err(|e| e.to_string())?;
    platform.start_app(&name)
}

#[tauri::command]
pub fn stop_app(state: State<AppState>, name: String) -> Result<String, String> {
    let platform = state.platform.lock().map_err(|e| e.to_string())?;
    platform.stop_app(&name)
}

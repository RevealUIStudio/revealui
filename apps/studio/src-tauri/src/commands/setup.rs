use tauri::State;

use crate::platform::trait_defs::SetupStatus;
use crate::state::AppState;

#[tauri::command]
pub fn check_setup(state: State<AppState>) -> Result<SetupStatus, String> {
    let platform = state.platform.lock().map_err(|e| e.to_string())?;
    platform.check_setup()
}

#[tauri::command]
pub fn set_git_identity(state: State<AppState>, name: String, email: String) -> Result<(), String> {
    let platform = state.platform.lock().map_err(|e| e.to_string())?;
    platform.set_git_identity(&name, &email)
}

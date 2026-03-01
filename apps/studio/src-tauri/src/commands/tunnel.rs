use tauri::State;

use crate::platform::trait_defs::TailscaleStatus;
use crate::state::AppState;

/// Get current Tailscale status including peers.
#[tauri::command]
pub fn get_tailscale_status(state: State<'_, AppState>) -> Result<TailscaleStatus, String> {
    let platform = state.platform.lock().map_err(|_| "platform lock poisoned".to_string())?;
    platform.get_tailscale_status()
}

/// Bring Tailscale up (connect).
#[tauri::command]
pub fn tailscale_up(state: State<'_, AppState>) -> Result<String, String> {
    let platform = state.platform.lock().map_err(|_| "platform lock poisoned".to_string())?;
    platform.tailscale_up()
}

/// Bring Tailscale down (disconnect).
#[tauri::command]
pub fn tailscale_down(state: State<'_, AppState>) -> Result<String, String> {
    let platform = state.platform.lock().map_err(|_| "platform lock poisoned".to_string())?;
    platform.tailscale_down()
}

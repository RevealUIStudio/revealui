use crate::config::{save_config, ConfigState, StudioConfig};
use tauri::State;

#[tauri::command]
pub fn get_config(state: State<ConfigState>) -> Result<StudioConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn set_config(state: State<ConfigState>, config: StudioConfig) -> Result<(), String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config.clone();
    save_config(&config)?;
    Ok(())
}

#[tauri::command]
pub fn reset_config(state: State<ConfigState>) -> Result<(), String> {
    let default_config = StudioConfig::default();
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = default_config.clone();
    save_config(&default_config)?;
    Ok(())
}

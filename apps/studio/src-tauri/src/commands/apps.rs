use std::process::Command;

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

/// Read the last N lines from a RevealUI app's log file.
#[tauri::command]
pub fn read_app_log(name: String, lines: Option<u32>) -> Result<String, String> {
    let n = lines.unwrap_or(50);
    let log_path = format!("/tmp/revealui-{}.log", name);

    // Try reading directly (works on Linux/macOS); fall back to wsl.exe on Windows
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("tail")
            .args(["-n", &n.to_string(), &log_path])
            .output()
            .map_err(|e| format!("Failed to read log: {e}"))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("No such file") {
                Ok(String::new())
            } else {
                Err(format!("tail failed: {stderr}"))
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("wsl.exe")
            .args(["-e", "tail", "-n", &n.to_string(), &log_path])
            .output()
            .map_err(|e| format!("Failed to read log: {e}"))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("No such file") {
                Ok(String::new())
            } else {
                Err(format!("tail failed: {stderr}"))
            }
        }
    }
}

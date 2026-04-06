use std::process::Command;

use super::error::StudioError;

/// Focus a running application window, or return false if it can't be focused.
/// The caller should fall back to launching the app if this returns false.
#[tauri::command]
pub fn focus_window(process_name: String) -> Result<bool, StudioError> {
    focus_window_platform(&process_name)
}

#[cfg(target_os = "windows")]
fn focus_window_platform(process_name: &str) -> Result<bool, StudioError> {
    // Use PowerShell to activate a window by process name
    // Strip .exe suffix for Get-Process matching
    let clean_name = process_name
        .strip_suffix(".exe")
        .unwrap_or(process_name);

    let script = format!(
        r#"$p = Get-Process -Name '{}' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p -and $p.MainWindowHandle -ne 0) {{ [void][System.Runtime.InteropServices.Marshal]::GetDelegateForFunctionPointer((Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);' -Name W -Namespace U -PassThru)::SetForegroundWindow, [Func[IntPtr,bool]]).Invoke($p.MainWindowHandle); $true }} else {{ $false }}"#,
        clean_name
    );

    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| StudioError::Process(e.to_string()))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim().eq_ignore_ascii_case("true"))
}

#[cfg(target_os = "linux")]
fn focus_window_platform(process_name: &str) -> Result<bool, StudioError> {
    // Try wmctrl first (most reliable), fall back to xdotool
    let wmctrl = Command::new("wmctrl")
        .args(["-a", process_name])
        .output();

    if let Ok(output) = wmctrl {
        if output.status.success() {
            return Ok(true);
        }
    }

    // Fallback: xdotool
    let xdotool = Command::new("xdotool")
        .args(["search", "--name", process_name, "windowactivate"])
        .output();

    if let Ok(output) = xdotool {
        return Ok(output.status.success());
    }

    Ok(false)
}

#[cfg(target_os = "macos")]
fn focus_window_platform(process_name: &str) -> Result<bool, StudioError> {
    // Use osascript to activate the application
    let script = format!(
        r#"tell application "System Events" to set frontmost of (first process whose name contains "{}") to true"#,
        process_name
    );

    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| StudioError::Process(e.to_string()))?;

    Ok(output.status.success())
}

/// Reads a text file from the filesystem (tilde-expanded path).
/// Used by the Agent panel to load workboard.md.
#[tauri::command]
pub fn agent_read_workboard(path: String) -> Result<String, String> {
    let expanded = if path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            format!("{}/{}", home.display(), &path[2..])
        } else {
            path.clone()
        }
    } else {
        path.clone()
    };
    std::fs::read_to_string(&expanded).map_err(|e| e.to_string())
}

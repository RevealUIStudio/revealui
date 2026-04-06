use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use super::error::StudioError;

/// A terminal emulator with its config file and install destination.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalProfile {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub installed: bool,
    pub config_file: String,
    pub dest_path: String,
}

/// Detect which terminal emulators are available and whether profiles are installed.
#[tauri::command]
pub fn terminal_detect() -> Result<Vec<TerminalProfile>, StudioError> {
    let mut profiles = Vec::new();
    let home = dirs::home_dir().ok_or_else(|| StudioError::Other("Cannot determine home directory".into()))?;

    #[cfg(target_os = "macos")]
    {
        // iTerm2
        let dest = home.join("Library/Application Support/iTerm2/DynamicProfiles/revealui.json");
        let detected = home.join("Library/Application Support/iTerm2").exists();
        if detected {
            profiles.push(TerminalProfile {
                id: "iterm2".into(),
                name: "iTerm2".into(),
                platform: "macOS".into(),
                installed: dest.exists(),
                config_file: "iterm2-revealui.json".into(),
                dest_path: dest.to_string_lossy().into(),
            });
        }

        // Terminal.app (always available on macOS)
        let dest = home.join("Desktop/RevealUI.terminal");
        profiles.push(TerminalProfile {
            id: "terminal-app".into(),
            name: "Terminal.app".into(),
            platform: "macOS".into(),
            installed: dest.exists(),
            config_file: "Terminal.app-RevealUI.terminal".into(),
            dest_path: dest.to_string_lossy().into(),
        });

        // Alacritty
        let dest = home.join(".config/alacritty/revealui.toml");
        let detected = home.join(".config/alacritty").exists()
            || which::which("alacritty").is_ok();
        if detected {
            profiles.push(TerminalProfile {
                id: "alacritty".into(),
                name: "Alacritty".into(),
                platform: "macOS".into(),
                installed: dest.exists(),
                config_file: "alacritty-revealui.toml".into(),
                dest_path: dest.to_string_lossy().into(),
            });
        }

        // Kitty
        let dest = home.join(".config/kitty/revealui.conf");
        let detected = home.join(".config/kitty").exists()
            || which::which("kitty").is_ok();
        if detected {
            profiles.push(TerminalProfile {
                id: "kitty".into(),
                name: "Kitty".into(),
                platform: "macOS".into(),
                installed: dest.exists(),
                config_file: "kitty-revealui.conf".into(),
                dest_path: dest.to_string_lossy().into(),
            });
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Alacritty
        let dest = home.join(".config/alacritty/revealui.toml");
        let detected = home.join(".config/alacritty").exists()
            || which::which("alacritty").is_ok();
        if detected {
            profiles.push(TerminalProfile {
                id: "alacritty".into(),
                name: "Alacritty".into(),
                platform: "Linux".into(),
                installed: dest.exists(),
                config_file: "alacritty-revealui.toml".into(),
                dest_path: dest.to_string_lossy().into(),
            });
        }

        // Kitty
        let dest = home.join(".config/kitty/revealui.conf");
        let detected = home.join(".config/kitty").exists()
            || which::which("kitty").is_ok();
        if detected {
            profiles.push(TerminalProfile {
                id: "kitty".into(),
                name: "Kitty".into(),
                platform: "Linux".into(),
                installed: dest.exists(),
                config_file: "kitty-revealui.conf".into(),
                dest_path: dest.to_string_lossy().into(),
            });
        }

        // GNOME Terminal
        let dest = home.join(".config/revealui/gnome-terminal-revealui.dconf");
        let detected = which::which("gnome-terminal").is_ok();
        if detected {
            profiles.push(TerminalProfile {
                id: "gnome-terminal".into(),
                name: "GNOME Terminal".into(),
                platform: "Linux".into(),
                installed: dest.exists(),
                config_file: "gnome-terminal-revealui.dconf".into(),
                dest_path: dest.to_string_lossy().into(),
            });
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows Terminal profile is managed via settings.json — just detect it
        let wt_settings = home.join("AppData/Local/Packages/Microsoft.WindowsTerminal_8wekyb3d8bbwe/LocalState/settings.json");
        if wt_settings.exists() {
            profiles.push(TerminalProfile {
                id: "windows-terminal".into(),
                name: "Windows Terminal".into(),
                platform: "Windows".into(),
                installed: false, // Would need to parse settings.json to check
                config_file: "".into(),
                dest_path: wt_settings.to_string_lossy().into(),
            });
        }
    }

    Ok(profiles)
}

/// Install a terminal profile by copying the config file to the correct location.
/// `config_dir` is the path to the `config/terminal/` directory in the repo.
#[tauri::command]
pub fn terminal_install(
    terminal_id: String,
    config_dir: String,
) -> Result<TerminalProfile, StudioError> {
    let profiles = terminal_detect()?;
    let profile = profiles
        .iter()
        .find(|p| p.id == terminal_id)
        .ok_or_else(|| StudioError::Other(format!("Unknown terminal: {}", terminal_id)))?;

    if profile.config_file.is_empty() {
        return Err(StudioError::Other(
            "This terminal does not support automatic profile installation".into(),
        ));
    }

    let src = PathBuf::from(&config_dir).join(&profile.config_file);
    if !src.exists() {
        return Err(StudioError::Other(format!(
            "Config file not found: {}",
            src.display()
        )));
    }

    let dest = PathBuf::from(&profile.dest_path);

    // Create parent directories
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::copy(&src, &dest)?;

    // Return updated profile with installed = true
    let mut updated = profile.clone();
    updated.installed = true;
    Ok(updated)
}

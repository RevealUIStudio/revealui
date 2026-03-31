use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "bindings/")]
pub struct StudioConfig {
    pub intent: Option<String>,
    pub setup_complete: bool,
    pub completed_steps: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deploy: Option<DeployConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub develop: Option<DevelopConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "bindings/")]
pub struct DeployConfig {
    pub vercel_team_id: Option<String>,
    pub domain: Option<String>,
    pub apps: Option<DeployApps>,
    pub neon_project_id: Option<String>,
    pub supabase_enabled: bool,
    pub email_provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "bindings/")]
pub struct DeployApps {
    pub api: Option<String>,
    pub cms: Option<String>,
    pub marketing: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "bindings/")]
pub struct DevelopConfig {
    pub repo_path: Option<String>,
    pub wsl_distro: Option<String>,
    pub nix_installed: bool,
}

impl Default for StudioConfig {
    fn default() -> Self {
        Self {
            intent: None,
            setup_complete: false,
            completed_steps: Vec::new(),
            deploy: None,
            develop: None,
        }
    }
}

pub struct ConfigState {
    pub config: Mutex<StudioConfig>,
}

impl ConfigState {
    pub fn new() -> Self {
        let config = load_config().unwrap_or_default();
        Self {
            config: Mutex::new(config),
        }
    }
}

fn config_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("revealui-studio").join("config.json")
}

fn load_config() -> Result<StudioConfig, String> {
    let path = config_path();
    if !path.exists() {
        return Ok(StudioConfig::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub fn save_config(config: &StudioConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

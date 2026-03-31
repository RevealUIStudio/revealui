use serde::Serialize;
use ts_rs::TS;

/// Cross-platform abstraction for Studio operations.
///
/// Windows implementation shells out to `pwsh.exe`, `wsl.exe`, and `git`.
/// Mac/Linux stubs return errors until implemented.
pub trait PlatformOps {
    /// Get WSL/system status: is WSL running, what tier, systemd state.
    fn get_system_status(&self) -> Result<SystemStatus, String>;

    /// Get Studio drive mount status.
    fn get_mount_status(&self) -> Result<MountStatus, String>;

    /// Mount the Studio SSD (may require elevation).
    fn mount_devbox(&self) -> Result<String, String>;

    /// Unmount the Studio SSD.
    fn unmount_devbox(&self) -> Result<String, String>;

    /// Sync all registered repos.
    fn sync_all_repos(&self) -> Result<Vec<SyncResult>, String>;

    /// Sync a single repo by name.
    fn sync_repo(&self, name: &str) -> Result<SyncResult, String>;

    /// List all RevealUI apps with their running status (port-based detection).
    fn list_apps(&self) -> Result<Vec<AppStatus>, String>;

    /// Start a RevealUI app by name in WSL (fire-and-forget via nohup).
    fn start_app(&self, name: &str) -> Result<String, String>;

    /// Stop a RevealUI app by killing its port (fuser -k).
    fn stop_app(&self, name: &str) -> Result<String, String>;

    /// Check environment setup status (WSL, Nix, DevPod, git config).
    fn check_setup(&self) -> Result<SetupStatus, String>;

    /// Set git global user.name and user.email in WSL.
    fn set_git_identity(&self, name: &str, email: &str) -> Result<(), String>;

    /// Get Tailscale connection status and peer list.
    fn get_tailscale_status(&self) -> Result<TailscaleStatus, String>;

    /// Bring Tailscale up (connect to the tailnet).
    fn tailscale_up(&self) -> Result<String, String>;

    /// Bring Tailscale down (disconnect from the tailnet).
    fn tailscale_down(&self) -> Result<String, String>;
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct SystemStatus {
    pub wsl_running: bool,
    pub distribution: String,
    pub tier: String,
    pub systemd_status: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct MountStatus {
    pub mounted: bool,
    pub mount_point: String,
    pub device: Option<String>,
    pub size_total: Option<String>,
    pub size_used: Option<String>,
    pub size_available: Option<String>,
    pub use_percent: Option<String>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct SyncResult {
    pub drive: String,
    pub repo: String,
    pub status: String,
    pub branch: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[cfg(target_os = "windows")]
#[ts(export, export_to = "bindings/", rename = "RepoInfo")]
pub struct RepoEntry {
    pub name: String,
    pub c_path: String,
    pub e_path: String,
    pub identity: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct AppInfo {
    pub name: String,
    pub display_name: String,
    pub port: u16,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct AppStatus {
    pub app: AppInfo,
    pub running: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct SetupStatus {
    pub wsl_running: bool,
    pub nix_installed: bool,
    pub devbox_mounted: bool,
    pub git_name: String,
    pub git_email: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct TailscaleStatus {
    pub running: bool,
    pub ip: Option<String>,
    pub hostname: Option<String>,
    pub peers: Vec<TailscalePeer>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct TailscalePeer {
    pub hostname: String,
    pub ip: String,
    pub online: bool,
    pub os: String,
}

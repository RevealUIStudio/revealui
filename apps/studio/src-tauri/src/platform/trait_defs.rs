use serde::Serialize;

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
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemStatus {
    pub wsl_running: bool,
    pub distribution: String,
    pub tier: String,
    pub systemd_status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MountStatus {
    pub mounted: bool,
    pub mount_point: String,
    pub device: Option<String>,
    pub size_total: Option<String>,
    pub size_used: Option<String>,
    pub size_available: Option<String>,
    pub use_percent: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SyncResult {
    pub drive: String,
    pub repo: String,
    pub status: String,
    pub branch: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RepoEntry {
    pub name: String,
    pub c_path: String,
    pub e_path: String,
    pub identity: String,
}

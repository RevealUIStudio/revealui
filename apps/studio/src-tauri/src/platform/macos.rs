use super::trait_defs::{AppStatus, MountStatus, PlatformOps, SyncResult, SystemStatus};

/// macOS stub — not yet implemented.
pub struct MacPlatform;

impl MacPlatform {
    pub fn new() -> Self {
        Self
    }
}

impl PlatformOps for MacPlatform {
    fn get_system_status(&self) -> Result<SystemStatus, String> {
        Err("macOS support not yet implemented".to_string())
    }

    fn get_mount_status(&self) -> Result<MountStatus, String> {
        Err("macOS support not yet implemented".to_string())
    }

    fn mount_devbox(&self) -> Result<String, String> {
        Err("macOS support not yet implemented".to_string())
    }

    fn unmount_devbox(&self) -> Result<String, String> {
        Err("macOS support not yet implemented".to_string())
    }

    fn sync_all_repos(&self) -> Result<Vec<SyncResult>, String> {
        Err("macOS support not yet implemented".to_string())
    }

    fn sync_repo(&self, _name: &str) -> Result<SyncResult, String> {
        Err("macOS support not yet implemented".to_string())
    }

    fn list_apps(&self) -> Result<Vec<AppStatus>, String> {
        Err("macOS support not yet implemented".to_string())
    }

    fn start_app(&self, _name: &str) -> Result<String, String> {
        Err("macOS support not yet implemented".to_string())
    }

    fn stop_app(&self, _name: &str) -> Result<String, String> {
        Err("macOS support not yet implemented".to_string())
    }
}

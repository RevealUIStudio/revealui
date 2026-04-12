use std::process::Command;

use super::trait_defs::{
    AppInfo, AppStatus, MountStatus, PlatformOps, SetupStatus, SyncResult, SystemStatus,
    TailscalePeer, TailscaleStatus,
};

/// Linux implementation — WSL-specific features unsupported; Tailscale and git run natively.
pub struct LinuxPlatform;

impl LinuxPlatform {
    pub fn new() -> Self {
        Self
    }
}

impl PlatformOps for LinuxPlatform {
    fn get_system_status(&self) -> Result<SystemStatus, String> {
        let systemd_status = Command::new("systemctl")
            .args(["--user", "is-system-running"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        Ok(SystemStatus {
            wsl_running: false,
            distribution: "linux".to_string(),
            tier: "unknown".to_string(),
            systemd_status,
        })
    }

    fn get_mount_status(&self) -> Result<MountStatus, String> {
        Ok(MountStatus {
            mounted: false,
            mount_point: "/mnt/wsl-dev".to_string(),
            device: None,
            size_total: None,
            size_used: None,
            size_available: None,
            use_percent: None,
        })
    }

    fn mount_devbox(&self) -> Result<String, String> {
        Err("DevPod mount requires Windows/WSL".to_string())
    }

    fn unmount_devbox(&self) -> Result<String, String> {
        Err("DevPod unmount requires Windows/WSL".to_string())
    }

    fn sync_all_repos(&self) -> Result<Vec<SyncResult>, String> {
        Err("Repo sync requires Windows/WSL".to_string())
    }

    fn sync_repo(&self, _name: &str) -> Result<SyncResult, String> {
        Err("Repo sync requires Windows/WSL".to_string())
    }

    fn list_apps(&self) -> Result<Vec<AppStatus>, String> {
        let output = Command::new("ps")
            .args(["-eo", "comm"])
            .output()
            .map_err(|e| format!("ps failed: {e}"))?;

        let text = String::from_utf8_lossy(&output.stdout);
        let processes: Vec<&str> = text.lines().collect();

        let known_apps: &[(&str, &str, &str)] = &[
            ("zed", "zed", "Zed"),
            ("google-chrome", "chrome", "Chrome"),
            ("chromium", "chromium", "Chromium"),
            ("cursor", "cursor", "Cursor"),
            ("claude", "claude", "Claude Code"),
            ("gnome-terminal", "gnome-terminal", "GNOME Terminal"),
            ("alacritty", "alacritty", "Alacritty"),
            ("kitty", "kitty", "Kitty"),
            ("tmux", "tmux", "tmux"),
            ("code", "code", "VS Code"),
        ];

        let mut apps = vec![];
        for (proc_name, name, display_name) in known_apps {
            let running = processes.iter().any(|p| p.contains(proc_name));
            if running {
                apps.push(AppStatus {
                    app: AppInfo {
                        name: name.to_string(),
                        display_name: display_name.to_string(),
                        port: 0,
                        url: String::new(),
                    },
                    running: true,
                });
            }
        }

        Ok(apps)
    }

    fn start_app(&self, name: &str) -> Result<String, String> {
        Command::new(name)
            .spawn()
            .map_err(|e| format!("{name}: {e}"))?;
        Ok(format!("Launched {name}"))
    }

    fn stop_app(&self, _name: &str) -> Result<String, String> {
        Err("App stop not supported on Linux (use the app's quit menu)".to_string())
    }

    fn check_setup(&self) -> Result<SetupStatus, String> {
        let git_name = Command::new("git")
            .args(["config", "--global", "user.name"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        let git_email = Command::new("git")
            .args(["config", "--global", "user.email"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        let nix_installed = Command::new("nix")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        Ok(SetupStatus {
            wsl_running: false,
            nix_installed,
            devbox_mounted: false,
            git_name,
            git_email,
        })
    }

    fn set_git_identity(&self, name: &str, email: &str) -> Result<(), String> {
        Command::new("git")
            .args(["config", "--global", "user.name", name])
            .output()
            .map_err(|e| format!("git config failed: {e}"))?;

        Command::new("git")
            .args(["config", "--global", "user.email", email])
            .output()
            .map_err(|e| format!("git config failed: {e}"))?;

        Ok(())
    }

    fn get_tailscale_status(&self) -> Result<TailscaleStatus, String> {
        let output = Command::new("tailscale")
            .args(["status", "--peers", "--self"])
            .output();

        let Ok(out) = output else {
            return Ok(TailscaleStatus {
                running: false,
                ip: None,
                hostname: None,
                peers: vec![],
            });
        };

        if !out.status.success() {
            return Ok(TailscaleStatus {
                running: false,
                ip: None,
                hostname: None,
                peers: vec![],
            });
        }

        // Parse plain-text `tailscale status` output.
        // First line is self: "100.x.y.z  hostname  user  active; ..."
        let text = String::from_utf8_lossy(&out.stdout);
        let mut lines = text.lines();
        let mut ip = None;
        let mut hostname = None;
        let mut peers = vec![];

        if let Some(self_line) = lines.next() {
            let parts: Vec<&str> = self_line.split_whitespace().collect();
            ip = parts.first().map(|s| s.to_string());
            hostname = parts.get(1).map(|s| s.to_string());
        }

        for line in lines {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 3 {
                continue;
            }
            let peer_ip = parts[0].to_string();
            let peer_hostname = parts[1].to_string();
            let online = parts.get(3).map(|s| s.starts_with("active")).unwrap_or(false);
            peers.push(TailscalePeer {
                hostname: peer_hostname,
                ip: peer_ip,
                online,
                os: "unknown".to_string(),
            });
        }

        Ok(TailscaleStatus {
            running: ip.is_some(),
            ip,
            hostname,
            peers,
        })
    }

    fn tailscale_up(&self) -> Result<String, String> {
        let out = Command::new("tailscale")
            .arg("up")
            .output()
            .map_err(|e| format!("tailscale up failed: {e}"))?;
        if out.status.success() {
            Ok("Connected".to_string())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
        }
    }

    fn tailscale_down(&self) -> Result<String, String> {
        let out = Command::new("tailscale")
            .arg("down")
            .output()
            .map_err(|e| format!("tailscale down failed: {e}"))?;
        if out.status.success() {
            Ok("Disconnected".to_string())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
        }
    }
}

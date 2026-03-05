use std::process::Command;

use super::trait_defs::{AppInfo, AppStatus, MountStatus, PlatformOps, RepoEntry, SetupStatus, SyncResult, SystemStatus, TailscalePeer, TailscaleStatus};

/// Windows implementation — shells out to `wsl.exe`, `pwsh.exe`, and `git`.
pub struct WindowsPlatform {
    distribution: String,
}

impl WindowsPlatform {
    pub fn new() -> Self {
        Self {
            distribution: "Ubuntu".to_string(),
        }
    }

    fn wsl_exec(&self, cmd: &str) -> Result<String, String> {
        let output = Command::new("wsl.exe")
            .args(["-d", &self.distribution, "-e", "bash", "-c", cmd])
            .output()
            .map_err(|e| format!("Failed to run wsl.exe: {e}"))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            if stderr.is_empty() {
                Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                Err(format!("WSL command failed: {stderr}"))
            }
        }
    }

    fn git_sync_c(&self, repo_path: &str) -> SyncResult {
        let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\user".to_string());
        let full_path = format!("{}\\{}", user_profile, repo_path);
        let branch = self.git_branch(&full_path);

        // Check if repo exists
        let git_dir = format!("{}/.git", full_path.replace('\\', "/"));
        if Command::new("cmd")
            .args(["/C", &format!("if exist \"{}\" echo EXISTS", git_dir.replace('/', "\\"))])
            .output()
            .map(|o| !String::from_utf8_lossy(&o.stdout).contains("EXISTS"))
            .unwrap_or(true)
        {
            // Use git to check directly
            let check = Command::new("git")
                .args(["-C", &full_path, "rev-parse", "--git-dir"])
                .output();

            if check.is_err() || !check.unwrap().status.success() {
                return SyncResult {
                    drive: "C:".to_string(),
                    repo: String::new(),
                    status: "skip".to_string(),
                    branch: "-".to_string(),
                };
            }
        }

        // Check if dirty
        let dirty = Command::new("git")
            .args(["-C", &full_path, "status", "--porcelain"])
            .output()
            .map(|o| !String::from_utf8_lossy(&o.stdout).trim().is_empty())
            .unwrap_or(false);

        if dirty {
            return SyncResult {
                drive: "C:".to_string(),
                repo: String::new(),
                status: "dirty".to_string(),
                branch,
            };
        }

        // Fetch and pull
        let _ = Command::new("git")
            .args(["-C", &full_path, "fetch", "origin", "--quiet"])
            .output();

        let pull = Command::new("git")
            .args(["-C", &full_path, "pull", "--ff-only"])
            .output();

        let status = match pull {
            Ok(o) if o.status.success() => "ok",
            _ => "diverged",
        };

        SyncResult {
            drive: "C:".to_string(),
            repo: String::new(),
            status: status.to_string(),
            branch,
        }
    }

    fn git_sync_e(&self, repo_path: &str) -> SyncResult {
        let full_path = format!("E:\\repos\\{}", repo_path);
        let branch = self.git_branch(&full_path);

        let check = Command::new("git")
            .args(["-C", &full_path, "rev-parse", "--git-dir"])
            .output();

        if check.is_err() || !check.unwrap().status.success() {
            return SyncResult {
                drive: "E:".to_string(),
                repo: String::new(),
                status: "skip".to_string(),
                branch: "-".to_string(),
            };
        }

        let _ = Command::new("git")
            .args(["-C", &full_path, "fetch", "origin", "--quiet"])
            .output();

        let reset = Command::new("git")
            .args([
                "-C",
                &full_path,
                "reset",
                "--hard",
                &format!("origin/{branch}"),
            ])
            .output();

        let status = match reset {
            Ok(o) if o.status.success() => "ok",
            _ => "reset_failed",
        };

        SyncResult {
            drive: "E:".to_string(),
            repo: String::new(),
            status: status.to_string(),
            branch,
        }
    }

    fn git_branch(&self, path: &str) -> String {
        Command::new("git")
            .args(["-C", path, "rev-parse", "--abbrev-ref", "HEAD"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_else(|_| "-".to_string())
    }

    fn repo_registry() -> Vec<RepoEntry> {
        vec![
            RepoEntry {
                name: "RevealUI".to_string(),
                c_path: "projects\\RevealUI".to_string(),
                e_path: "professional\\RevealUI".to_string(),
                identity: "professional".to_string(),
            },
            RepoEntry {
                name: "revault".to_string(),
                c_path: "projects\\revault".to_string(),
                e_path: "professional\\revault".to_string(),
                identity: "professional".to_string(),
            },
            RepoEntry {
                name: "devkit".to_string(),
                c_path: ".revealui".to_string(),
                e_path: "professional\\devkit".to_string(),
                identity: "professional".to_string(),
            },
        ]
    }

    fn app_registry() -> Vec<AppInfo> {
        vec![
            AppInfo {
                name: "api".to_string(),
                display_name: "API".to_string(),
                port: 3004,
                url: "http://localhost:3004".to_string(),
            },
            AppInfo {
                name: "cms".to_string(),
                display_name: "CMS".to_string(),
                port: 4000,
                url: "http://localhost:4000".to_string(),
            },
            AppInfo {
                name: "marketing".to_string(),
                display_name: "Marketing".to_string(),
                port: 3000,
                url: "http://localhost:3000".to_string(),
            },
            AppInfo {
                name: "mainframe".to_string(),
                display_name: "Mainframe".to_string(),
                port: 3001,
                url: "http://localhost:3001".to_string(),
            },
            AppInfo {
                name: "docs".to_string(),
                display_name: "Docs".to_string(),
                port: 3002,
                url: "http://localhost:3002".to_string(),
            },
        ]
    }

    fn app_dev_command(name: &str) -> Option<String> {
        match name {
            "api" => Some("pnpm dev:api".to_string()),
            "cms" => Some("pnpm dev:cms".to_string()),
            "marketing" => Some("pnpm --filter marketing dev".to_string()),
            "mainframe" => Some("pnpm --filter mainframe dev".to_string()),
            "docs" => Some("pnpm --filter docs dev".to_string()),
            _ => None,
        }
    }

    /// Decode the UTF-16LE output produced by `wsl.exe --list` and similar
    /// Windows-native wsl.exe subcommands.  Standard WSL shell commands routed
    /// through `wsl_exec` (bash -c) are UTF-8 and must NOT use this function.
    fn decode_utf16le(bytes: &[u8]) -> String {
        // Strip BOM (0xFF 0xFE) if present
        let bytes = if bytes.starts_with(&[0xFF, 0xFE]) { &bytes[2..] } else { bytes };
        let words: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        String::from_utf16_lossy(&words)
    }

    fn is_port_listening(&self, port: u16) -> bool {
        self.wsl_exec(&format!(
            "ss -tlnp 2>/dev/null | grep -qE ':{port}(\\s|$)' && echo yes || echo no"
        ))
        .map(|s| s.trim() == "yes")
        .unwrap_or(false)
    }
}

impl PlatformOps for WindowsPlatform {
    fn get_system_status(&self) -> Result<SystemStatus, String> {
        // Check if WSL is running
        let wsl_check = Command::new("wsl.exe")
            .args(["--list", "--running"])
            .output()
            .map_err(|e| format!("Failed to check WSL: {e}"))?;

        let wsl_output = Self::decode_utf16le(&wsl_check.stdout);
        let wsl_running = wsl_output.contains(&self.distribution);

        if !wsl_running {
            return Ok(SystemStatus {
                wsl_running: false,
                distribution: self.distribution.clone(),
                tier: "unknown".to_string(),
                systemd_status: "unknown".to_string(),
            });
        }

        // Derive tier from whether the Studio drive is mounted.
        // DEVKIT_TIER is only available in interactive login shells, so we use
        // mountpoint instead — T1 if /mnt/studio is mounted, T0 otherwise.
        let tier = self
            .wsl_exec("mountpoint -q /mnt/studio && echo T1 || echo T0")
            .unwrap_or_else(|_| "unknown".to_string());

        // Get systemd status
        let systemd_status = self
            .wsl_exec("systemctl --user is-system-running 2>/dev/null || echo stopped")
            .unwrap_or_else(|_| "unknown".to_string());

        Ok(SystemStatus {
            wsl_running: true,
            distribution: self.distribution.clone(),
            tier,
            systemd_status,
        })
    }

    fn get_mount_status(&self) -> Result<MountStatus, String> {
        let mount_point = "/mnt/studio".to_string();

        // Check if mounted
        let check = self.wsl_exec("mountpoint -q /mnt/studio && echo MOUNTED || echo NOT_MOUNTED");
        let mounted = check
            .as_ref()
            .map(|s| s.contains("MOUNTED") && !s.contains("NOT_MOUNTED"))
            .unwrap_or(false);

        if !mounted {
            return Ok(MountStatus {
                mounted: false,
                mount_point,
                device: None,
                size_total: None,
                size_used: None,
                size_available: None,
                use_percent: None,
            });
        }

        // Get disk usage info
        let df_output = self.wsl_exec("df -h /mnt/studio | tail -1")?;
        let parts: Vec<&str> = df_output.split_whitespace().collect();

        Ok(MountStatus {
            mounted: true,
            mount_point,
            device: parts.first().map(|s| s.to_string()),
            size_total: parts.get(1).map(|s| s.to_string()),
            size_used: parts.get(2).map(|s| s.to_string()),
            size_available: parts.get(3).map(|s| s.to_string()),
            use_percent: parts.get(4).map(|s| s.to_string()),
        })
    }

    fn mount_devbox(&self) -> Result<String, String> {
        // Spawn elevated PowerShell to run Mount-WSLDev
        let output = Command::new("pwsh.exe")
            .args([
                "-NoProfile",
                "-Command",
                "Import-Module RevealUI.DevEnv; Mount-WSLDev -SkipWait -Confirm:$false",
            ])
            .output()
            .map_err(|e| format!("Failed to start pwsh.exe: {e}"))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        if output.status.success() {
            Ok(if stdout.is_empty() {
                "Mount command completed".to_string()
            } else {
                stdout
            })
        } else {
            Err(if stderr.is_empty() {
                "Mount command failed".to_string()
            } else {
                stderr
            })
        }
    }

    fn unmount_devbox(&self) -> Result<String, String> {
        // Find the physical drive number first, then unmount
        let output = Command::new("pwsh.exe")
            .args([
                "-NoProfile",
                "-Command",
                r#"$serial = $env:REVEALUI_DEVBOX_SERIAL; if (-not $serial) { Write-Error 'REVEALUI_DEVBOX_SERIAL not set'; exit 1 }; $disk = Get-Disk | Where-Object { $_.SerialNumber -match $serial }; if ($disk) { wsl.exe --unmount "\\.\PHYSICALDRIVE$($disk.Number)" } else { Write-Error 'Studio drive not found' }"#,
            ])
            .output()
            .map_err(|e| format!("Failed to start pwsh.exe: {e}"))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        if output.status.success() {
            Ok(if stdout.is_empty() {
                "Unmount completed".to_string()
            } else {
                stdout
            })
        } else {
            Err(if stderr.is_empty() {
                "Unmount failed".to_string()
            } else {
                stderr
            })
        }
    }

    fn sync_all_repos(&self) -> Result<Vec<SyncResult>, String> {
        let registry = Self::repo_registry();
        let e_available = std::path::Path::new("E:\\repos").exists();
        let mut results = Vec::new();

        for repo in &registry {
            // C: drive sync
            let mut c_result = self.git_sync_c(&repo.c_path);
            c_result.repo = repo.name.clone();
            results.push(c_result);

            // E: drive sync (if available)
            if e_available {
                let mut e_result = self.git_sync_e(&repo.e_path);
                e_result.repo = repo.name.clone();
                results.push(e_result);
            }
        }

        Ok(results)
    }

    fn sync_repo(&self, name: &str) -> Result<SyncResult, String> {
        let registry = Self::repo_registry();
        let repo = registry
            .iter()
            .find(|r| r.name == name)
            .ok_or_else(|| format!("Repo '{name}' not found in registry"))?;

        let mut result = self.git_sync_c(&repo.c_path);
        result.repo = repo.name.clone();
        Ok(result)
    }

    fn list_apps(&self) -> Result<Vec<AppStatus>, String> {
        let registry = Self::app_registry();
        let statuses = registry
            .into_iter()
            .map(|app| {
                let running = self.is_port_listening(app.port);
                AppStatus { app, running }
            })
            .collect();
        Ok(statuses)
    }

    fn start_app(&self, name: &str) -> Result<String, String> {
        let dev_cmd = Self::app_dev_command(name)
            .ok_or_else(|| format!("Unknown app: {name}"))?;

        let bash_cmd = format!(
            "cd ~/projects/RevealUI && nohup {dev_cmd} > /tmp/revealui-{name}.log 2>&1 &"
        );

        Command::new("wsl.exe")
            .args(["-d", &self.distribution, "-e", "bash", "-c", &bash_cmd])
            .spawn()
            .map_err(|e| format!("Failed to start {name}: {e}"))?;

        Ok(format!("Starting {name}..."))
    }

    fn stop_app(&self, name: &str) -> Result<String, String> {
        let port = Self::app_registry()
            .into_iter()
            .find(|a| a.name == name)
            .map(|a| a.port)
            .ok_or_else(|| format!("Unknown app: {name}"))?;

        self.wsl_exec(&format!("fuser -k {port}/tcp 2>/dev/null; true"))
            .map(|_| format!("Stopped {name}"))
    }

    fn check_setup(&self) -> Result<SetupStatus, String> {
        // Check WSL running
        let wsl_check = Command::new("wsl.exe")
            .args(["--list", "--running"])
            .output()
            .map_err(|e| format!("Failed to check WSL: {e}"))?;
        let wsl_running = Self::decode_utf16le(&wsl_check.stdout).contains(&self.distribution);

        if !wsl_running {
            return Ok(SetupStatus {
                wsl_running: false,
                nix_installed: false,
                devbox_mounted: false,
                git_name: String::new(),
                git_email: String::new(),
            });
        }

        // Check Nix
        let nix_installed = self
            .wsl_exec("which nix 2>/dev/null && echo YES || echo NO")
            .map(|s| s.trim() == "YES")
            .unwrap_or(false);

        // Check DevBox mount
        let devbox_mounted = self
            .wsl_exec("mountpoint -q /mnt/studio && echo MOUNTED || echo NOT_MOUNTED")
            .map(|s| s.contains("MOUNTED") && !s.contains("NOT_MOUNTED"))
            .unwrap_or(false);

        // Read git config (pass args directly — no shell injection risk)
        let git_name = Command::new("wsl.exe")
            .args(["-d", &self.distribution, "-e", "git", "config", "--global", "user.name"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        let git_email = Command::new("wsl.exe")
            .args(["-d", &self.distribution, "-e", "git", "config", "--global", "user.email"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        Ok(SetupStatus { wsl_running, nix_installed, devbox_mounted, git_name, git_email })
    }

    fn set_git_identity(&self, name: &str, email: &str) -> Result<(), String> {
        Command::new("wsl.exe")
            .args(["-d", &self.distribution, "-e", "git", "config", "--global", "user.name", name])
            .output()
            .map_err(|e| format!("Failed to set git name: {e}"))?;

        Command::new("wsl.exe")
            .args(["-d", &self.distribution, "-e", "git", "config", "--global", "user.email", email])
            .output()
            .map_err(|e| format!("Failed to set git email: {e}"))?;

        Ok(())
    }

    fn get_tailscale_status(&self) -> Result<TailscaleStatus, String> {
        let json = self.wsl_exec("tailscale status --json 2>/dev/null")?;

        if json.is_empty() {
            return Ok(TailscaleStatus {
                running: false,
                ip: None,
                hostname: None,
                peers: vec![],
            });
        }

        let parsed: serde_json::Value = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse tailscale status: {e}"))?;

        let running = parsed["BackendState"].as_str() == Some("Running");

        let ip = parsed["Self"]["TailscaleIPs"]
            .as_array()
            .and_then(|ips| ips.first())
            .and_then(|v| v.as_str())
            .map(String::from);

        let hostname = parsed["Self"]["HostName"]
            .as_str()
            .map(String::from);

        let peers = parsed["Peer"]
            .as_object()
            .map(|peers_map| {
                peers_map
                    .values()
                    .map(|peer| TailscalePeer {
                        hostname: peer["HostName"].as_str().unwrap_or("unknown").to_string(),
                        ip: peer["TailscaleIPs"]
                            .as_array()
                            .and_then(|ips| ips.first())
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string(),
                        online: peer["Online"].as_bool().unwrap_or(false),
                        os: peer["OS"].as_str().unwrap_or("unknown").to_string(),
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(TailscaleStatus { running, ip, hostname, peers })
    }

    fn tailscale_up(&self) -> Result<String, String> {
        self.wsl_exec("tailscale up 2>&1")
    }

    fn tailscale_down(&self) -> Result<String, String> {
        self.wsl_exec("tailscale down 2>&1")
    }
}

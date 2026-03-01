use std::process::Command;

use super::trait_defs::{MountStatus, PlatformOps, RepoEntry, SyncResult, SystemStatus};

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
        let full_path = format!("C:\\Users\\joshu\\{}", repo_path);
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
            RepoEntry {
                name: "portfolio".to_string(),
                c_path: "projects\\portfolio".to_string(),
                e_path: "personal\\portfolio".to_string(),
                identity: "personal".to_string(),
            },
            RepoEntry {
                name: "joshua-v-dev".to_string(),
                c_path: "projects\\joshua-v-dev".to_string(),
                e_path: "personal\\joshua-v-dev".to_string(),
                identity: "personal".to_string(),
            },
            RepoEntry {
                name: "off-set-designs".to_string(),
                c_path: "projects\\off-set-designs".to_string(),
                e_path: "personal\\off-set-designs".to_string(),
                identity: "personal".to_string(),
            },
            RepoEntry {
                name: "angler-adventures".to_string(),
                c_path: "projects\\angler-adventures".to_string(),
                e_path: "personal\\angler-adventures".to_string(),
                identity: "personal".to_string(),
            },
            RepoEntry {
                name: "supaturbo".to_string(),
                c_path: "projects\\supaturbo".to_string(),
                e_path: "personal\\supaturbo".to_string(),
                identity: "personal".to_string(),
            },
            RepoEntry {
                name: "flow".to_string(),
                c_path: "projects\\flow".to_string(),
                e_path: "personal\\flow".to_string(),
                identity: "personal".to_string(),
            },
            RepoEntry {
                name: "igotmaps".to_string(),
                c_path: "projects\\igotmaps".to_string(),
                e_path: "personal\\igotmaps".to_string(),
                identity: "personal".to_string(),
            },
        ]
    }
}

impl PlatformOps for WindowsPlatform {
    fn get_system_status(&self) -> Result<SystemStatus, String> {
        // Check if WSL is running
        let wsl_check = Command::new("wsl.exe")
            .args(["--list", "--running"])
            .output()
            .map_err(|e| format!("Failed to check WSL: {e}"))?;

        let wsl_output = String::from_utf8_lossy(&wsl_check.stdout);
        let wsl_running = wsl_output.contains(&self.distribution);

        if !wsl_running {
            return Ok(SystemStatus {
                wsl_running: false,
                distribution: self.distribution.clone(),
                tier: "unknown".to_string(),
                systemd_status: "unknown".to_string(),
            });
        }

        // Get tier
        let tier = self
            .wsl_exec("echo \"${DEVKIT_TIER:-unknown}\"")
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
                r#"$disk = Get-Disk | Where-Object { $_.SerialNumber -match 'WXB2A91FA77H' }; if ($disk) { wsl.exe --unmount "\\.\PHYSICALDRIVE$($disk.Number)" } else { Write-Error 'Studio drive not found' }"#,
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
}

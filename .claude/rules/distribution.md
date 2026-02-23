# Repository Distribution

RevealUI exists in multiple locations. The WSL-native clone is the primary development environment.

## Locations

| Location | Path | Role | Sync |
|----------|------|------|------|
| WSL native | `~/projects/RevealUI` | Primary development | `git push origin` |
| GitHub | `RevealUIStudio/revealui` | Remote source of truth | automatic via push |
| LTS (E:) | `/mnt/e/professional/RevealUI` | Offline backup | `git push lts` (auto via post-push hook) |
| DevBox | `/mnt/wsl-dev/projects/RevealUI` | Portable dev (when mounted) | `git pull origin` when connected |
| Windows | `C:\Users\joshu\projects\RevealUI` | Read-only reference | Automated robocopy every 15 min |

## Remotes (WSL native clone)

- `origin` → GitHub (`RevealUIStudio/revealui`)
- `lts` → LTS drive (`/mnt/e/professional/RevealUI`)

## Sync Commands

```bash
# Push to GitHub (standard)
git push origin main

# Sync to LTS backup drive
git push lts main

# Sync DevBox when mounted
git -C /mnt/wsl-dev/projects/RevealUI pull origin main
```

## LTS Drive Notes

- NTFS filesystem — set `core.fileMode false` to suppress permission noise
- Used as offline backup, not for active development
- Sync after significant milestones, not every commit

## DevBox Notes

- ext4 USB drive, mounted at `/mnt/wsl-dev` when plugged in
- fstab entry exists but is disabled (`mountFsTab = false` in wsl.conf)
- Mount manually: `sudo mount /dev/sdd1 /mnt/wsl-dev`
- Full dev environment — can run `pnpm dev` directly
- Zed workspace should point to `/mnt/wsl-dev/projects/RevealUI` (not `/mnt/wsl-dev/home/...`)

## Windows Reference Clone

The Windows clone at `C:\Users\joshu\projects\RevealUI` is a **read-only mirror** for Windows apps that can't read the WSL filesystem directly.

### Automated Sync (Task Scheduler)
- **Script:** `C:\Scripts\sync-revealui-to-windows.ps1`
- **Schedule:** Every 15 minutes via Task Scheduler (`RevealUI\RevealUI-WSL-Sync`)
- **Setup:** Run `C:\Scripts\setup-revealui-sync-task.ps1` as Administrator (one-time)
- **Method:** robocopy /MIR with exclusions (node_modules, .next, dist, .turbo, .git, .pgdata)
- **Log:** `C:\Scripts\logs\sync-revealui.log`

### Manual Sync
```bash
# From WSL
git -C /mnt/c/Users/joshu/projects/RevealUI pull origin main

# From PowerShell
powershell -File C:\Scripts\sync-revealui-to-windows.ps1
```

## Cross-Platform Access

From Windows PowerShell, use `wsl` commands to access the WSL-native clone:
```bash
wsl -d Ubuntu -e git -C ~/projects/RevealUI status
```

From Zed, the workspace connects via WSL remote (remote_connection with user=joshua-v-dev).

## Licensing

RevealUI uses a dual-license model:
- **MIT** (`LICENSE`): 13 OSS packages (core, cli, presentation, contracts, db, auth, config, router, setup, sync, dev, test, utils)
- **Commercial** (`LICENSE.commercial`): Pro/Enterprise packages (ai, mcp, editors, services, harnesses) and any `/ee` directories

Commercial packages have `"license": "SEE LICENSE IN ../../LICENSE.commercial"` in their package.json.

## DevBox Workflow (ext4 USB Drive)

The DevBox (WD My Passport 2626, 1TB, ext4) is a portable dev environment.

### Architecture
1. Drive is connected to Windows USB
2. `wsl --mount` attaches the physical drive to WSL in bare mode
3. A helper script (`/usr/local/bin/mount-dev-drive.sh`) finds the ext4 partition and mounts it
4. Mount point: `/mnt/wsl-dev`
5. PowerShell function `wslmount` triggers the process

### Mount Flow
```
Windows USB → wsl --mount (bare) → find ext4 partition → mount at /mnt/wsl-dev
```

### Key Files
- `C:\Scripts\mount-wsl-dev.ps1` — Windows mount orchestrator (finds drive by serial)
- `/usr/local/bin/mount-dev-drive.sh` — WSL partition finder and mounter
- `/etc/sudoers.d/wsl-mount` — Passwordless sudo for mount ops

### ext4 vs NTFS
- **DevBox (ext4)**: Full Unix permission support, native Linux I/O speed, no `core.fileMode` issues
- **LTS (NTFS)**: Needs `core.fileMode false`, slower via 9p layer, permission noise

## Cross-Platform Developer Experience

RevealUI targets these platforms for contributors:

| Platform | Filesystem | Git Config | Dev Shell |
|----------|-----------|------------|-----------|
| Linux native | ext4/btrfs | Default | Nix flake |
| macOS | APFS | Default | Nix flake |
| WSL 2 (Ubuntu) | ext4 | Default | Nix flake |
| Windows (NTFS) | NTFS | `core.fileMode false` | Not recommended (use WSL) |

### Plug-and-Play Goal
Any developer should be able to:
1. `git clone` the repo
2. Enter the directory (Nix + direnv auto-activate)
3. `pnpm install` (enforced by `only-allow pnpm`)
4. `pnpm dev` to start all services

The Nix flake provides: Node.js, pnpm, Biome, and all system dependencies.
For non-Nix users, `packages/setup` provides fallback setup utilities.

### Platform-Specific Notes
- **NTFS drives**: Always set `core.fileMode false` in git config
- **9p mount (WSL ↔ Windows)**: Slower I/O. Keep working copies on native filesystems.
- **USB ext4 on WSL**: Requires `wsl --mount` (admin). Not available on native Linux/Mac (direct mount).

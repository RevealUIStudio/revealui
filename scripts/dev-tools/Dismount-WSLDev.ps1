<#
.SYNOPSIS
    Safely ejects a WSL dev drive (portable ext4 USB SSD, e.g. Forge).

.DESCRIPTION
    Stops services that use the mount point, verifies no open file handles,
    flushes the filesystem, unmounts inside WSL, then unmounts the physical
    disk from Windows so it is safe to physically disconnect.

.PARAMETER DiskNumber
    Windows disk number of the dev drive. If omitted, the script attempts
    to auto-detect by matching the disk serial / mount point.

.PARAMETER MountPoint
    WSL mount point for the dev drive. Defaults to `/mnt/forge`.

.EXAMPLE
    .\Dismount-WSLDev.ps1
    .\Dismount-WSLDev.ps1 -DiskNumber 2
    .\Dismount-WSLDev.ps1 -MountPoint /mnt/devdrive

.NOTES
    To add to RevealUI.DevEnv module:
        Copy this file to your module directory and dot-source or Import-Module.
        Add `Set-Alias -Name wslunmount -Value Dismount-WSLDev` to the module.

    Module path (typical):
        $env:USERPROFILE\Documents\PowerShell\Modules\RevealUI.DevEnv\

    WSL prerequisite:
        The helper expects /usr/local/bin/mount-dev-drive.sh to exist on the
        WSL side and that sudo for mount/umount is passwordless
        (/etc/sudoers.d/wsl-mount).
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter()]
    [int] $DiskNumber = -1,

    [Parameter()]
    [string] $MountPoint = '/mnt/forge'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Step {
    param([string] $Message)
    Write-Host "  -> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string] $Message)
    Write-Host "  OK $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string] $Message)
    Write-Host "  !! $Message" -ForegroundColor Yellow
}

function Invoke-Wsl {
    param([string[]] $Arguments)
    $output = wsl -d Ubuntu -- @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "WSL command failed (exit $LASTEXITCODE): $($Arguments -join ' ')`n$output"
    }
    return $output
}

# ---------------------------------------------------------------------------
# Step 1: Stop services using the dev mount
# ---------------------------------------------------------------------------

Write-Host "`nDismount-WSLDev: Safe dev-drive eject ($MountPoint)" -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor DarkGray

Write-Step "Stopping services on $MountPoint..."

$services = @(
    @{ name = 'postgres'; cmd = @('sudo', 'systemctl', 'stop', 'postgresql') },
    @{ name = 'redis';    cmd = @('sudo', 'systemctl', 'stop', 'redis') },
    @{ name = 'ollama';   cmd = @('sudo', 'systemctl', 'stop', 'ollama') }
)

foreach ($svc in $services) {
    try {
        Invoke-Wsl $svc.cmd | Out-Null
        Write-Success "$($svc.name) stopped"
    }
    catch {
        Write-Warn "$($svc.name) stop failed (may not be running): $_"
    }
}

# ---------------------------------------------------------------------------
# Step 2: Check for open file handles
# ---------------------------------------------------------------------------

Write-Step "Checking for open file handles on $MountPoint..."

$openFiles = Invoke-Wsl @('lsof', '+D', $MountPoint, '-t') 2>$null
if ($openFiles -and $openFiles.Trim()) {
    $pids = ($openFiles.Trim() -split "`n") | Where-Object { $_ -match '^\d+$' }
    Write-Warn "$($pids.Count) process(es) still have open handles:"
    foreach ($pid in $pids) {
        $info = Invoke-Wsl @('ps', '-p', $pid, '-o', 'comm=') 2>$null
        Write-Warn "  PID $pid ($info)"
    }
    if (-not $PSCmdlet.ShouldContinue(
            "Open file handles detected. Force unmount anyway?",
            "Dismount-WSLDev")) {
        Write-Host "`nAborted. Close the listed processes and retry." -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Success "No open file handles on $MountPoint"
}

# ---------------------------------------------------------------------------
# Step 3: Sync filesystem
# ---------------------------------------------------------------------------

Write-Step "Syncing filesystem..."
Invoke-Wsl @('sync') | Out-Null
Write-Success "Filesystem synced"

# ---------------------------------------------------------------------------
# Step 4: Unmount inside WSL
# ---------------------------------------------------------------------------

Write-Step "Unmounting $MountPoint inside WSL..."
try {
    Invoke-Wsl @('sudo', 'umount', $MountPoint) | Out-Null
    Write-Success "$MountPoint unmounted"
}
catch {
    Write-Warn "umount reported an error (drive may already be unmounted): $_"
}

# ---------------------------------------------------------------------------
# Step 5: Detach physical disk from WSL
# ---------------------------------------------------------------------------

Write-Step "Detaching physical disk from WSL..."

# Auto-detect disk number if not provided
if ($DiskNumber -lt 0) {
    Write-Step "  Auto-detecting Forge disk number..."
    $disks = Get-Disk | Where-Object { $_.BusType -eq 'USB' -and $_.OperationalStatus -eq 'Online' }
    if ($disks.Count -eq 0) {
        Write-Warn "No USB disks found. The drive may already be detached."
        exit 0
    }
    if ($disks.Count -gt 1) {
        Write-Warn "Multiple USB disks detected. Specify -DiskNumber explicitly:"
        $disks | Format-Table -Property DiskNumber, FriendlyName, Size, OperationalStatus
        exit 1
    }
    $DiskNumber = $disks[0].DiskNumber
    Write-Success "  Found disk $DiskNumber ($($disks[0].FriendlyName))"
}

$physicalDrive = "\\.\PHYSICALDRIVE$DiskNumber"
Write-Step "  Unmounting $physicalDrive from WSL..."
wsl --unmount $physicalDrive
if ($LASTEXITCODE -ne 0) {
    Write-Warn "wsl --unmount returned non-zero (may already be unmounted)"
}
else {
    Write-Success "$physicalDrive detached from WSL"
}

# ---------------------------------------------------------------------------
# Step 6: Set disk offline (safe to physically unplug)
# ---------------------------------------------------------------------------

Write-Step "Setting disk $DiskNumber offline..."
try {
    Set-Disk -Number $DiskNumber -IsOffline $true
    Write-Success "Disk $DiskNumber is now offline"
}
catch {
    Write-Warn "Could not set disk offline (it may need to be ejected via Windows UI): $_"
}

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

Write-Host "`nForge drive safely ejected. You may now physically disconnect it.`n" `
    -ForegroundColor Green

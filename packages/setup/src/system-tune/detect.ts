/**
 * System Detection Layer
 *
 * Scans the host's hardware and platform to produce a SystemInfo snapshot.
 * This is the "read" side — no mutations, only observation.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { arch, cpus, freemem, homedir, platform, release, totalmem } from 'node:os';
import { join } from 'node:path';
import type { PlatformClass, SystemInfo } from './types.js';

// =============================================================================
// Platform Detection
// =============================================================================

function detectPlatformClass(): PlatformClass {
  const p = platform();

  if (p === 'linux') {
    // Check for WSL2
    try {
      const procVersion = readFileSync('/proc/version', 'utf8').toLowerCase();
      if (procVersion.includes('microsoft') || procVersion.includes('wsl')) {
        return 'wsl2';
      }
    } catch {
      // Not available — continue
    }

    // Check for Docker/container
    try {
      if (existsSync('/.dockerenv')) return 'docker';
      const cgroup = readFileSync('/proc/1/cgroup', 'utf8');
      if (cgroup.includes('docker') || cgroup.includes('containerd')) return 'docker';
    } catch {
      // Not available — continue
    }

    // Check for cloud VM (common indicators)
    try {
      const dmiProduct = readFileSync('/sys/class/dmi/id/product_name', 'utf8')
        .trim()
        .toLowerCase();
      if (
        dmiProduct.includes('virtual') ||
        dmiProduct.includes('kvm') ||
        dmiProduct.includes('xen') ||
        dmiProduct.includes('hvm')
      ) {
        return 'cloud-vm';
      }
    } catch {
      // Not available — bare metal or restricted
    }

    return 'linux';
  }

  if (p === 'darwin') return 'macos';
  if (p === 'win32') return 'windows';
  return 'unknown';
}

function detectDistro(): string | undefined {
  try {
    const osRelease = readFileSync('/etc/os-release', 'utf8');
    const match = osRelease.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
    return match?.[1];
  } catch {
    return undefined;
  }
}

// =============================================================================
// Memory Detection
// =============================================================================

function detectMemory(): SystemInfo['memory'] {
  const p = platform();

  if (p === 'linux') {
    try {
      const meminfo = readFileSync('/proc/meminfo', 'utf8');
      const parse = (key: string): number => {
        const match = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
        return match ? Number.parseInt(match[1], 10) * 1024 : 0; // kB → bytes
      };
      return {
        totalBytes: parse('MemTotal'),
        freeBytes: parse('MemAvailable') || parse('MemFree'),
        swapTotalBytes: parse('SwapTotal'),
        swapFreeBytes: parse('SwapFree'),
      };
    } catch {
      // Fallback to Node.js APIs
    }
  }

  return {
    totalBytes: totalmem(),
    freeBytes: freemem(),
    swapTotalBytes: 0,
    swapFreeBytes: 0,
  };
}

// =============================================================================
// CPU Detection
// =============================================================================

function detectCpu(): SystemInfo['cpu'] {
  const cores = cpus();
  const model = cores[0]?.model ?? 'unknown';
  const logicalCores = cores.length;

  // Physical cores: try platform-specific detection
  let physicalCores = logicalCores;
  const p = platform();
  if (p === 'linux') {
    try {
      const output = execSync('grep "^cpu cores" /proc/cpuinfo | head -1', {
        encoding: 'utf8',
        timeout: 2000,
      });
      const match = output.match(/:\s*(\d+)/);
      if (match) physicalCores = Number.parseInt(match[1], 10);
    } catch {
      // Fallback — use logical as estimate
    }
  } else if (p === 'darwin') {
    try {
      const output = execSync('sysctl -n hw.physicalcpu', { encoding: 'utf8', timeout: 2000 });
      physicalCores = Number.parseInt(output.trim(), 10) || logicalCores;
    } catch {
      // Fallback
    }
  }

  return { model, physicalCores, logicalCores };
}

// =============================================================================
// Disk Detection
// =============================================================================

function detectDisk(): SystemInfo['disk'] {
  const p = platform();
  const target = process.cwd();

  if (p === 'linux' || p === 'darwin') {
    try {
      const output = execSync(`df -B1 "${target}" | tail -1`, { encoding: 'utf8', timeout: 2000 });
      const parts = output.trim().split(/\s+/);
      // df -B1 columns: Filesystem 1B-blocks Used Available Use% Mounted
      if (parts.length >= 4) {
        return {
          totalBytes: Number.parseInt(parts[1], 10) || 0,
          freeBytes: Number.parseInt(parts[3], 10) || 0,
        };
      }
    } catch {
      // Fallback
    }
  }

  return { totalBytes: 0, freeBytes: 0 };
}

// =============================================================================
// Existing Config Detection
// =============================================================================

function detectExistingConfigs(): SystemInfo['existingConfigs'] {
  const home = homedir();

  // .wslconfig (Windows-side, but accessible from WSL via /mnt/c/Users/<user>/)
  let wslconfig = false;
  try {
    // In WSL, check the Windows-side .wslconfig
    const windowsUser = execSync('cmd.exe /c "echo %USERPROFILE%" 2>/dev/null', {
      encoding: 'utf8',
      timeout: 3000,
    }).trim();
    const wslPath = windowsUser
      .replace(/\\/g, '/')
      .replace(/^([A-Z]):/i, (_, d: string) => `/mnt/${d.toLowerCase()}`);
    wslconfig = existsSync(join(wslPath, '.wslconfig'));
  } catch {
    wslconfig = existsSync(join(home, '.wslconfig'));
  }

  // earlyoom
  let earlyoom = false;
  try {
    const result = execSync('systemctl is-enabled earlyoom 2>/dev/null', {
      encoding: 'utf8',
      timeout: 2000,
    });
    earlyoom = result.trim() === 'enabled';
  } catch {
    earlyoom = false;
  }

  // Docker autostart
  let dockerAutostart = false;
  try {
    const result = execSync('systemctl is-enabled docker 2>/dev/null', {
      encoding: 'utf8',
      timeout: 2000,
    });
    dockerAutostart = result.trim() === 'enabled';
  } catch {
    dockerAutostart = false;
  }

  // NODE_OPTIONS
  const nodeOptions = process.env.NODE_OPTIONS ?? null;

  return { wslconfig, earlyoom, dockerAutostart, nodeOptions };
}

// =============================================================================
// Public API
// =============================================================================

/** Scan the current host and return a SystemInfo snapshot. */
export function detectSystem(): SystemInfo {
  return {
    os: {
      platform: platform(),
      release: release(),
      arch: arch(),
      distro: detectDistro(),
    },
    platformClass: detectPlatformClass(),
    memory: detectMemory(),
    cpu: detectCpu(),
    disk: detectDisk(),
    existingConfigs: detectExistingConfigs(),
  };
}

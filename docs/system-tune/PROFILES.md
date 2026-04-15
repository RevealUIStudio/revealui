# System Tune Profiles

Tuning profiles map a (platform, RAM bucket) pair to a set of safe defaults.
Each profile is a JSON file in `packages/setup/src/system-tune/profiles/`.

## Profile Matrix

| Profile ID | Platform | RAM Range | Key Settings |
|-----------|----------|-----------|--------------|
| `wsl-low-ram` | WSL2 | ≤ 8 GB | memory=4GB, processors=2, swap=2GB, vmIdleTimeout=-1, earlyoom, Docker off |

## WSL Low-RAM (seed profile)

**ID:** `wsl-low-ram`
**File:** `packages/setup/src/system-tune/profiles/wsl-low-ram.json`

### Rationale

| Setting | Value | Why |
|---------|-------|-----|
| `memory=4GB` | Hard cap | On a 7.3 GB host, the default ~6 GB allocation starves Windows (explorer, antimalware, Terminal). 4 GB gives WSL enough for Node 24 + turbo builds while leaving ~3 GB for Windows. |
| `processors=2` | 2 logical | Limits CPU contention. On a 4-core host, 2 cores for WSL keeps the host responsive. |
| `swap=2GB` | 2 GB | Provides overflow for memory spikes during `pnpm install` or parallel builds. |
| `vmIdleTimeout=-1` | Never idle | Disables idle shutdown to prevent clock-skew bugs and `git` timestamp drift when the VM resumes. |
| `autoMemoryReclaim=disabled` | Off | `dropcache` reclaim on host-pressure systems causes I/O stalls and OOM-like symptoms. Off is safer on low-RAM hosts. |
| `networkingMode=mirrored` | Mirrored | Shares the host network stack — simplifies port forwarding for dev servers. |
| `NODE_OPTIONS --max-old-space-size=2048` | 2 GB | Prevents Node from claiming all available RAM during TypeScript compilation or Vitest runs. |
| `pnpm child-concurrency=2` | 2 | Limits parallel package installs to avoid memory spikes. |
| `turbo concurrency=2` | 2 | Limits parallel task execution in Turborepo. |
| `vitest maxThreads=2` | 2 | Prevents Vitest from spawning too many worker threads. |
| `earlyoom` | 5% mem, 10% swap | Kills memory hogs before the kernel OOM killer freezes the system. Prefers dev tools (turbo, biome, vitest, tsc, esbuild). |
| `Docker autostart=false` | Off | Docker daemon + containerd use ~200-400 MB at idle. On-demand via `sudo systemctl start docker`. |

## Adding New Profiles

1. Create a JSON file in `packages/setup/src/system-tune/profiles/`
2. Follow the `TuneProfile` schema (see `types.ts`)
3. Import and add to the `PROFILES` array in `profiles.ts` (most specific first)
4. Document the profile in this file with a rationale table

# System Tune — Crash Postmortems

Canonical crash/incident log that seeds the `@revealui/system-tune` profile matrix. Every entry here should trace to a concrete profile adjustment in `profiles/*.json` so new users never debug the same class of failure.

---

## 2026-04-13 — WSL 7.3 GB host crash loop

**Host:** Windows 11, 7.3 GB physical RAM, 6 logical cores. WSL2 Ubuntu 24.04.
**Symptom:** WSL VM crashed three times inside 20 minutes during a multi-package Vitest run. Each crash killed the session mid-command; systemd logged nothing useful because the VM died with the journal.

**Trigger:** Running `pnpm vitest run --reporter=verbose` at the monorepo root. The root vitest config auto-sized workers to 4 and loaded all 862 test files in a single vitest process, pushing RSS past 5 GB.

**Root cause chain:**
1. Default `.wslconfig` let the VM claim ~80% of host RAM (~6 GB).
2. Once the VM hit ~5 GB working set, Windows started host-side memory reclaim on the VM.
3. `[experimental] autoMemoryReclaim=dropcache` made the VM aggressively drop page cache under that pressure, stalling I/O.
4. `vmIdleTimeout` left idle auto-pause on — paused/resumed VMs saw "time jumped backwards" clock skew, which correlated 1:1 with the crash timestamps.
5. Net result: host pressure + cache drop + clock skew → VM kill.

**Fix (applied to host `.wslconfig`):**
- `memory=4GB` (leaves ~3 GB for Windows)
- `vmIdleTimeout=-1` (disable idle auto-pause)
- Removed `[experimental] autoMemoryReclaim=dropcache`
- Kept `networkingMode=nat` (reverted from `mirrored` 2026-03-22 after a separate 0x80072746 WinSock crash class)

**Fix (applied inside VM):**
- `earlyoom -m 15,8 -s 15,8 --prefer '(turbo|biome|vitest|tsc|esbuild)' -r 10` — kills runaway dev tools before the kernel OOM-killer hits system processes.
- Docker Desktop autostart disabled; start on demand with `sudo systemctl start docker`.

**Workflow fix (applied to this session):**
- Replaced root `pnpm vitest run` with serial per-package `pnpm --filter <pkg> test` loop (`/tmp/test-logs/run-all.sh`). One vitest process at a time caps memory at ~1 GB per package, well under the 4 GB WSL cap.
- Incidentally this also surfaced that root `pnpm vitest run` ignores per-package vitest configs (jsdom env, setup files, etc.), so the 1139 "failures" reported at root level were false alarms. Real failure count: 1 flaky timeout test in `@revealui/ai`, already patched.

**Profile entry:** `profiles/wsl-low-ram.json` captures the exact values above as the `wsl-low-ram` profile. It is the seed baseline for the `@revealui/system-tune` detection+apply pipeline (Phase 5.17).

**Prevention (future work, tracked in master plan 5.17):**
- `revealui system scan` should detect `hostRamGb <= 8 && platform == wsl2 && wslconfig.memory undefined` and apply this profile before a new user ever hits a test run.
- Studio first-run wizard should offer to apply it after detecting the same signature.
- CI snapshot on WSL runner to catch drift if defaults ever regress.

---

## Template for new entries

```
## YYYY-MM-DD — short title

**Host:** platform, specs.
**Symptom:** what the user saw.
**Trigger:** what they ran.
**Root cause chain:** numbered list from trigger to failure.
**Fix:** what changed, and where.
**Profile entry:** which `profiles/*.json` encodes the fix.
**Prevention:** what `@revealui/system-tune` should do automatically.
```

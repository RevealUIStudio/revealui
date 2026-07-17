# Claude Tool Routing

RevealUI's authoritative working tree lives on a **WSL ext4 filesystem**. When you reach it from a **Windows host over UNC** (`\\wsl$\...` / `\\wsl.localhost\...`), route work by *where the filesystem boundary is safe*, not by which OS the tool runs on.

Claude Code runs natively on Windows, macOS, and Linux (see https://code.claude.com/docs/en/setup). This rule is about filesystem correctness across the Windows/WSL (9P/UNC) boundary. It is **not** a claim that Claude Code needs WSL or can't run on Windows.

## One instance, two surfaces

A single Windows-host Claude Code instance can span both contexts:

| Surface | Example path | Filesystem | Role |
|---------|--------------|------------|------|
| RevealUI (authoritative) | `\\wsl$\<distro>\...\revfleet\revealui\` (UNC) | WSL ext4 | Read + coordination from the Windows host |
| Personal / Windows-native projects | e.g. `E:\projects\<repo>` | NTFS | Full native read/write |

The older "one Windows instance for personal work, a separate WSL instance for RevealUI" split is obsolete. A single Windows-host instance now spans both, spinning up a WSL-native session for the write/build work below.

## Read + coordinate from the Windows host

Fine to do over UNC from the Windows-host instance:

- Read / grep / audit RevealUI files.
- `gh` issue / PR / project work.
- Coordination edits that live on NTFS (global Claude config, Windows scripts).
- Invoking WSL commands via `wsl.exe -d <distro> -- bash -lc '...'`, which then run natively inside WSL, off the UNC path.

## Route writes, git, build, and test through WSL-native

Any **write / git state / build / test** against the RevealUI tree must run from a **WSL-native Claude Code session** (start `claude` inside WSL at `~/revfleet/revealui`), or be driven into WSL via `wsl.exe`. Do **not** use `Edit` / `Write`, or run Windows (MSYS) git, against the tree over UNC.

Why (a **correctness** choice, not a tool limitation):

- The `\\wsl$` / `\\wsl.localhost` path is served by the Plan 9 (9P) redirector. It silently no-ops some `Edit` / `Write` calls, serves stale reads after WSL-side writes, and makes Windows (MSYS) git report phantom modified files.
- No UNC-side setting fixes this. The fix is structural: run the actor natively on ext4.
- Heavy dev-shell work (Nix/direnv, `pnpm install`, long Vitest/Playwright runs, Docker builds, deploys) also belongs in a WSL-native session for native PATH tooling and no UNC latency.

| Action | Where |
|--------|-------|
| Read / grep / audit, `gh` issue / PR | Windows host (UNC) or WSL-native |
| `Edit` / `Write` RevealUI files | WSL-native (or driven via `wsl.exe`) |
| `git` status / commit / push | WSL-native (Windows MSYS git over UNC reports phantom status) |
| Build / test / deploy | WSL-native |

## Coordination

When more than one session is active (e.g. a Windows-host instance plus a dedicated WSL terminal), coordinate via the shared workboard and assume peers may touch the same tree. Default assumption: yours is the only active instance. Re-check if told otherwise. See `coordination.md` for the session-lifecycle protocol.

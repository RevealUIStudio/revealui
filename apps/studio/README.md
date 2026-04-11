# RevealUI Studio

Native AI experience  -  agent coordination hub, local inference management, visual agent dashboard, DevPod manager, and secret vault.

Built with Tauri 2 + React 19 + Tailwind CSS v4.

## Features

- **Dashboard**  -  Service status overview with tier badge
- **Vault**  -  Secret management via Revvault (age encryption), namespace filtering, clipboard integration
- **Infrastructure**  -  App launcher (start/stop/open 5 apps by port) + DevPod mount/unmount
- **Sync**  -  Repository sync across locations (WSL, LTS, DevPod)
- **Tunnel**  -  Tailscale status, connect/disconnect, peer list with 10s polling
- **Setup**  -  First-run wizard (environment check, vault init, Tailscale, project setup)

## Stack

- **Desktop**: Tauri 2
- **UI**: React 19 + Tailwind CSS v4
- **Backend**: Rust (PlatformOps trait with Windows/WSL implementation)
- **Vault**: revvault-core + age encryption + secrecy
- **Tunnel**: Tailscale CLI integration

## Development

```bash
# Start Vite dev server (frontend only)
pnpm dev

# Start Tauri dev (frontend + Rust backend)
pnpm tauri:dev

# Build for production
pnpm tauri:build

# Build Windows installer
pnpm build:windows
```

## Architecture

```
apps/studio/
├── src/                    # React frontend
│   ├── App.tsx
│   ├── components/
│   │   ├── apps/           # App launcher
│   │   ├── dashboard/      # Dashboard + service cards
│   │   ├── devbox/         # DevPod manager
│   │   ├── infrastructure/ # Infrastructure panel (apps + devbox)
│   │   ├── layout/         # AppShell, Sidebar, StatusBar
│   │   ├── setup/          # Setup wizard + setup page
│   │   ├── sync/           # Repo sync panel
│   │   ├── tunnel/         # Tailscale tunnel panel
│   │   └── vault/          # Secret vault UI
│   ├── hooks/              # React hooks (use-apps, use-devbox, use-setup, use-status, use-sync, use-tunnel, use-vault)
│   ├── lib/invoke.ts       # Typed Tauri command wrappers
│   └── types.ts            # Shared TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri commands (apps, devbox, sync, vault, tunnel)
│   │   ├── platform/       # PlatformOps trait + OS implementations
│   │   └── lib.rs          # Plugin registration
│   └── Cargo.toml
└── package.json
```

## Rust Backend

The Rust backend uses a `PlatformOps` trait for cross-platform operations:

- **Windows/WSL**: Shells out to `wsl.exe`, `pwsh.exe`, `git` for WSL operations
- **Linux/macOS**: Direct system calls (stubs for now)

App management uses `ss -tlnp` for status detection and `fuser -k PORT/tcp` for stopping.

## Related

- [Architecture Guide](../../docs/ARCHITECTURE.md)
- [Distribution Guide](../../.claude/rules/distribution.md)

## License

MIT

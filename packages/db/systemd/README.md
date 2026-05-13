# Drizzle Studio — systemd-user service

Durable supervision pattern for `drizzle-kit studio`. Replaces ad-hoc `tmux`/`nohup`/`screen` invocations with a proper systemd-user unit: auto-restart on crash, journal logging, clean start/stop semantics, on-demand by design.

Mirrors the revdev daemon's pattern at `packages/daemon/systemd/`.

## One-time install

```bash
pnpm --filter @revealui/db db:setup:studio
```

This:

1. Copies `drizzle-studio.service` to `~/.config/systemd/user/`
2. Seeds `~/.config/drizzle-studio/env` (mode 0600, gitignored)
3. Runs `systemctl --user daemon-reload`

The unit does NOT enable auto-start. Drizzle Studio is on-demand — prod DB access should be intentional and time-bounded.

## Starting against prod

```bash
bash packages/db/systemd/start-prod.sh
```

Fetches `POSTGRES_URL` from revvault (path: `revealui/prod/neon/postgres-url`), writes it to the env file at mode 0600, starts the service.

Open `https://local.drizzle.studio` in your browser. Studio's hosted frontend connects back to `127.0.0.1:4983` where the systemd-user unit is bound.

## Stopping + clearing credentials

```bash
systemctl --user stop drizzle-studio
bash packages/db/systemd/clear-env.sh
```

`clear-env.sh` zeros the `POSTGRES_URL` in the env file. The prod credential never sits at rest between sessions.

## Starting against dev / test / local

```bash
# Edit the env file directly:
$EDITOR ~/.config/drizzle-studio/env
# Then:
systemctl --user start drizzle-studio
```

Or with a different revvault path:

```bash
REVVAULT_PATH=revealui/test/neon/postgres-url bash packages/db/systemd/start-prod.sh
```

## Inspecting the running service

```bash
systemctl --user status drizzle-studio
journalctl  --user -u drizzle-studio -f       # live logs
journalctl  --user -u drizzle-studio --since "10 minutes ago"
ss -tlnp | grep 4983                           # confirm listener
```

## Uninstalling

```bash
systemctl --user stop drizzle-studio
systemctl --user disable drizzle-studio
rm ~/.config/systemd/user/drizzle-studio.service
rm -rf ~/.config/drizzle-studio
systemctl --user daemon-reload
```

## Why systemd-user and not tmux / nohup

`drizzle-kit studio` has been observed to exit unexpectedly in some shell/PTY configurations (`nohup` + `setsid` are insufficient on their own; the process exits within seconds in non-interactive bash invocations). systemd-user provides:

- **Proper supervision** — `Restart=on-failure` with backoff; the unit stays available across crashes.
- **Clean lifecycle** — start/stop/status are first-class operations, not "find the PID and kill it."
- **Journal logging** — `journalctl --user -u drizzle-studio` is the standard. No `/tmp/.studio.log` files.
- **No terminal coupling** — the service is independent of any shell or tmux session.
- **Security** — `NoNewPrivileges`, `PrivateTmp`, env file mode 0600, bound to `127.0.0.1` only.

This is also the durable-only path per fleet engineering posture (`feedback_durable_only`).

## Cross-OS reachability (WSL2 ↔ Windows browser)

The unit binds to `127.0.0.1:4983` inside WSL. WSL2's `localhostForwarding` (default-on in NAT mode) bridges this to Windows-side `localhost:4983`, so the Drizzle Studio frontend at `local.drizzle.studio` (which resolves to 127.0.0.1) connects through cleanly.

If your Chrome blocks "Local Network Access" on first visit, grant the permission via the URL bar's Site Information icon and reload. (Chrome's LNA policy applies to any public site reaching loopback — orthogonal to systemd; same applies to a tmux-launched instance.)

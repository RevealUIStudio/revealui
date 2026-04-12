# RevealUI Terminal

> **Status: Experimental**  -  Not production-deployed. Functional prototype for SSH-based license purchases.

SSH payment service built with the [Charm](https://charm.sh/) ecosystem:

- **Wish**  -  SSH server
- **Bubble Tea**  -  TUI framework
- **Lip Gloss**  -  Terminal styling

## Usage

```bash
ssh terminal.revealui.com
```

Presents an interactive TUI for browsing tiers, purchasing licenses, and managing agent credits  -  all from the terminal.

## Development

```bash
cd apps/terminal
go run .
```

## Deployment

Requires persistent TCP (SSH), not serverless. Deploy to Fly.io or a VPS:

```bash
docker build -t revealui-terminal .
docker run -p 2222:2222 revealui-terminal
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `2222` | SSH port |
| `HOST_KEY_PATH` | `.ssh/term_ed25519` | SSH host key |
| `REVEALUI_API_URL` | `https://api.revealui.com` | API endpoint |
| `REVEALUI_API_TOKEN` |  -  | Optional API token |

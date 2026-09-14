---
title: "Admin /chat push-to-talk — local Whisper sidecar"
description: "Studio dogfood: laptop localhost sidecar for STT + local files. Optional Cloudflare Tunnel + Access for a later phone seat. Tauri shell SOW is separate. Not a public SKU."
visibility: internal
status: verified
audience: operator
---

# Admin `/chat` push-to-talk (local Whisper sidecar)

Studio dogfood only. Not a public SKU. No CapCut. No cloud STT vendor. No Tailscale.

Voice-in is **local Whisper** (`small` family) through a **localhost sidecar**. Voice-out is the existing **Speak replies** speak-back. Secrets stay unspoken.

Mic stays **off** until you press and hold **Hold to talk**. Release inserts the transcript into the same composer as typed text. You still press **Send**.

**Hosted `admin.revealui.com` cannot read your laptop disk.** STT and local images/files go through `127.0.0.1` (or a future Tauri shell on the same ports). If the sidecar is down, `/chat` **fail-closes** with a clear alert — it will not call OpenAI / AssemblyAI / Deepgram and it will not pretend the hosted PWA can see your files.

## Seats

| Seat | This PR | Notes |
|------|---------|--------|
| **Laptop (primary)** | `http://127.0.0.1:8178/transcribe` and `/files` | Hold-to-talk + **Attach via sidecar**. Same ports a future Tauri shell can own. |
| **Phone** | Follow-on | Do not block this PR on phone filesystem. Optional later: Cloudflare Tunnel (Free) + Access to the **laptop** sidecar. On-device WASM is explicit opt-in only (`NEXT_PUBLIC_WHISPER_ENGINE=wasm`). |
| **Tauri shell** | Out of scope | Same localhost ports / permissions. **SOW is a separate ticket** — this PR does not ship a shell. |

Do **not** promise arbitrary filesystem access from hosted `.com`.

## Documented sidecar contract

Default origin: `http://127.0.0.1:8178` (Tauri-stable).

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/transcribe` | multipart `file` + `model=small` | `{ "text": "..." }` |
| `GET` | `/files` | — | `{ "files": [{ "id", "name", "mime", "href" }] }` |
| `POST` | `/files` | multipart `file` | `{ "id", "name", "mime", "href" }` |

A future Tauri process should serve these same paths. Operators may still point `WHISPER_URL` at whisper.cpp `.../v1/audio/transcriptions` for STT-only; **Attach via sidecar** still needs `/files` on the sidecar origin.

## Operator steps (laptop dogfood)

1. Start **whisper.cpp** (`small`) on an upstream port (sidecar proxies here):

```bash
whisper-server \
  -m ggml-small.bin \
  --host 127.0.0.1 \
  --port 8179
```

faster-whisper equivalent:

```bash
whisper-asr --model small --host 127.0.0.1 --port 8179
```

2. Start the studio sidecar (owns `8178`):

```bash
pnpm whisper:sidecar
```

Optional env:

```text
WHISPER_SIDECAR_HOST=127.0.0.1
WHISPER_SIDECAR_PORT=8178
WHISPER_UPSTREAM=http://127.0.0.1:8179/v1/audio/transcriptions
WHISPER_SIDECAR_FILES_DIR=~/.revealui/whisper-sidecar/files
```

3. Open admin Agent **`/chat`** on the **same machine**. Confirm **Hold to talk** is idle (mic off).
4. Hold, speak, release. Transcript lands in the composer. Edit if needed, then **Send**.
5. **Attach via sidecar** picks a file in the browser and **POSTs the blob to localhost `/files`**. The composer gets `[local file: name]`. Hosted admin never sees an OS path.
6. Optional: enable **Speak replies**. Secrets stay unspoken.

If the sidecar is down, the controls show a fail-closed alert. Start `pnpm whisper:sidecar` and retry. CORS must allow the admin origin (the reference sidecar sends `Access-Control-Allow-Origin: *` for dogfood). Chrome allows `http://127.0.0.1` from an HTTPS admin page.

### STT-only (whisper.cpp on 8178, no attach)

```text
WHISPER_URL=http://127.0.0.1:8178/v1/audio/transcriptions
NEXT_PUBLIC_WHISPER_ENGINE=sidecar
```

Attach will fail closed until `/files` is served on that origin.

## Phone (follow-on, not required to merge)

Near-term phone seat talks to the **laptop-hosted sidecar**, not the phone disk and not a hosted `.com` filesystem.

Optional: expose `127.0.0.1:8178` with **Cloudflare Tunnel (Free)** and put **Cloudflare Access** in front:

```text
NEXT_PUBLIC_WHISPER_URL=https://<access-protected-host>/transcribe
```

Complete the Access login on the phone, then hold-to-talk. Laptop must be online.

Do **not** introduce Tailscale or any paid mesh VPN. Same-WiFi private IPv4 is allowed if you pin that URL yourself; it is not the recommended path.

On-device WASM (`NEXT_PUBLIC_WHISPER_ENGINE=wasm`) is a leftover opt-in for experiments. It is **not** the product default and cannot give hosted `.com` local files.

## CSP / Permissions-Policy

- `connect-src` always includes loopback `8178`, plus any allowed `WHISPER_URL` origin (LAN or `*.trycloudflare.com`). Hugging Face weight hosts remain only for explicit WASM opt-in.
- `microphone=(self)` on `/chat` only. Camera/geo stay off.
- Cloud STT hostnames are refused even if set in env.

## Not in scope

- Public marketing / pricing copy
- Cloud STT SaaS
- Tailscale
- A second speech rewriter
- Promising hosted `.com` can read the phone or laptop disk
- Shipping a Tauri shell in this PR (separate SOW)
- Blocking merge on a phone app or phone filesystem

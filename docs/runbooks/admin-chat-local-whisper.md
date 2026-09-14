---
title: "Admin /chat push-to-talk — local Whisper"
description: "Studio dogfood: on-device WASM on phone, localhost sidecar on laptop, optional Cloudflare Tunnel + Access. Not a public SKU."
visibility: internal
status: verified
audience: operator
---

# Admin `/chat` push-to-talk (local Whisper)

Studio dogfood only. Not a public SKU. No CapCut. No cloud STT vendor. No Tailscale.

Voice-in is **local Whisper** (`small` family). Voice-out is the existing **Speak replies** speak-back. Secrets stay unspoken.

Mic stays **off** until you press and hold **Hold to talk** (full-width, thumb-sized). Release inserts the transcript into the same composer as typed text. You still press **Send**.

## Seats

| Seat | STT path | Notes |
|------|----------|--------|
| **Phone (RevBot in admin `/chat`)** | **On-device WASM** (`Xenova/whisper-tiny.en`, small-class family) | Open hosted HTTPS admin on the phone. Audio never leaves the device. First hold may download model weights from Hugging Face (cache afterwards). |
| **Laptop** | **localhost sidecar** | `WHISPER_URL=http://127.0.0.1:8178/v1/audio/transcriptions`. Same contract a future Tauri shell can own. Tauri SOW is separate — do not expect arbitrary filesystem from hosted `.com`. |
| **Phone → laptop sidecar (optional)** | **Cloudflare Tunnel (Free) + Access** | Point `NEXT_PUBLIC_WHISPER_URL` at the Access-protected tunnel hostname. Laptop must be online. **Do not use Tailscale.** |

Default engine is **WASM** when `WHISPER_URL` / `NEXT_PUBLIC_WHISPER_URL` is unset, so a phone does not call its own `127.0.0.1`.

## Phone dogfood (primary)

1. On the phone, open the **HTTPS** admin (Safari or Chrome) and sign in.
2. Go to Agent **`/chat`** (not a CEO / Grok messaging channel).
3. Confirm **Hold to talk** is idle (mic off). First hold may take a while while the WASM model loads.
4. Hold the wide control, speak, release.
5. Transcript lands in the composer. Edit if needed, then **Send**.
6. Optional: enable **Speak replies**. Secrets stay unspoken.

Requires `getUserMedia` (HTTPS). If WASM cannot start, the control fail-closes with an on-device message — it will not call OpenAI / AssemblyAI / Deepgram.

Override model (YouTube-pipeline size, heavier on phones):

```text
NEXT_PUBLIC_WHISPER_WASM_MODEL=Xenova/whisper-small.en
```

## Laptop sidecar

```text
WHISPER_URL=http://127.0.0.1:8178/v1/audio/transcriptions
NEXT_PUBLIC_WHISPER_ENGINE=sidecar
```

Sidecar API: `POST /v1/audio/transcriptions` form (`file` + `model=small`) → `{ "text": "..." }`. Optional future attach contract: `POST /files` on the same loopback process (Tauri / native picker). Not required to merge this PR.

### whisper.cpp (`small`)

```bash
whisper-server \
  -m ggml-small.bin \
  --host 127.0.0.1 \
  --port 8178
```

### faster-whisper (`small`)

```bash
whisper-asr --model small --host 127.0.0.1 --port 8178
```

Enable CORS for the admin origin (or `*`) if the admin tab is not same-origin. Chrome allows `http://127.0.0.1` from an HTTPS admin page.

## Optional phone → laptop (Cloudflare Tunnel + Access)

When the laptop sidecar is running and you want the **phone** to use that same process (not on-device WASM):

1. Expose `127.0.0.1:8178` with **Cloudflare Tunnel (Free)**.
2. Put **Cloudflare Access** in front of that hostname.
3. Set `NEXT_PUBLIC_WHISPER_URL=https://<access-protected-host>/v1/audio/transcriptions`.
4. On the phone, complete the Access login, then hold-to-talk.

Do **not** introduce Tailscale or any paid mesh VPN. Same-WiFi private IPv4 (`192.168/10/172.16`) is allowed if you pin that URL yourself; it is not the recommended path.

Cloud STT hostnames are refused even if set in env.

## CSP / Permissions-Policy

- `script-src` includes `'wasm-unsafe-eval'`; `worker-src` is `'self' blob:` (WASM worker).
- `connect-src` includes loopback `8178`, Hugging Face **weight** hosts (not STT APIs), plus any allowed `WHISPER_URL` origin (LAN or `*.trycloudflare.com`).
- `microphone=(self)` on `/chat` only. Camera/geo stay off.

## Not in scope

- Public marketing / pricing copy
- Cloud STT SaaS
- Tailscale
- A second speech rewriter
- Promising hosted `.com` can read the phone or laptop disk
- Shipping a Tauri shell in this PR

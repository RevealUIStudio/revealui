---
title: "Admin /chat push-to-talk — local Whisper sidecar"
description: "Studio dogfood: run whisper small on loopback so admin Agent /chat can transcribe hold-to-talk. Not a public SKU."
visibility: internal
status: verified
audience: operator
---

# Admin `/chat` push-to-talk (local Whisper)

Studio dogfood only. Voice-in uses a **local Whisper `small`** sidecar (same model class as the YouTube caption pipeline). Voice-out stays the existing speak-back TTS. There is no cloud STT vendor, no CapCut, and no new product SKU.

Mic stays **off** until you press and hold **Hold to talk**. Release inserts the transcript into the same composer as typed text. You still press **Send**.

## Sidecar

Default browser target:

```text
WHISPER_URL=http://127.0.0.1:8178/v1/audio/transcriptions
```

Override with `NEXT_PUBLIC_WHISPER_URL` (admin browser) or `WHISPER_URL` (CSP + same default). Only **loopback** hosts (`127.0.0.0/8`, `localhost`, `::1`) are accepted. A SaaS STT URL is refused.

The sidecar must speak the OpenAI-compatible `POST /v1/audio/transcriptions` form (`file` + `model=small`) and return JSON `{ "text": "..." }`. Enable CORS for the admin origin (or `*`) so the browser can reach loopback from the admin tab. Chrome allows `http://127.0.0.1` from an HTTPS admin page.

### whisper.cpp (`small`)

```bash
# ggml-small.bin — same family as the YouTube pipeline
whisper-server \
  -m ggml-small.bin \
  --host 127.0.0.1 \
  --port 8178
```

### faster-whisper (`small`)

```bash
# Example: OpenAI-compatible HTTP wrapper around faster-whisper small
# Bind loopback only. Add CORS for the admin origin.
whisper-asr --model small --host 127.0.0.1 --port 8178
```

In-browser WASM Whisper is an allowed on-device alternative; this runbook uses the HTTP sidecar.

## Admin

1. Sign in to admin → **Agent** `/chat` (not a CEO route).
2. Confirm **Hold to talk** is idle (mic off).
3. Hold the control, speak, release.
4. Edit the composer if needed, then **Send**.
5. Optional: turn on **Speak replies** (existing speak-back; secrets stay unspoken).

If the sidecar is down, the control fail-closes with a local-Whisper message. It will not fall back to Web Speech or any STT SaaS.

## CSP / Permissions-Policy

- `connect-src` includes `http://127.0.0.1:8178` (and `localhost` / `[::1]` on that port), plus any extra **loopback** origin from `WHISPER_URL`.
- `Permissions-Policy` is `microphone=(self)` on `/chat` only. Other admin routes keep `microphone=()`.
- Camera and geolocation stay off.

## Not in scope

- Public marketing / pricing copy
- Cloud STT (OpenAI, AssemblyAI, Deepgram, Google, Azure, …)
- A second speech rewriter (speak-back already owns voice-out)

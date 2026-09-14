---
title: "Admin /chat push-to-talk — local Whisper sidecar"
description: "Studio dogfood: laptop localhost sidecar for STT + local files. Phone is a separate on-device follow-on seat and does not call the laptop. Not a public SKU."
visibility: internal
status: verified
audience: operator
---

# Admin `/chat` push-to-talk (local Whisper sidecar)

Studio dogfood only. Not a public SKU. No CapCut. No cloud STT vendor.

Voice-in is **local Whisper** (`small` family) through a **localhost sidecar**. Voice-out is the existing **Speak replies** speak-back. Secrets stay unspoken.

Mic stays **off** until you press and hold **Hold to talk**. Release inserts the transcript into the same composer as typed text. You still press **Send**.

**Hosted `admin.revealui.com` cannot read your laptop disk.** STT and local images/files go through `127.0.0.1`. A future **Tauri shell** is the intended primary seat and should own these same localhost ports — **Tauri SOW is a separate ticket**. If the sidecar is down, `/chat` **fail-closes** with a clear alert — it will not call OpenAI / AssemblyAI / Deepgram and it will not pretend the hosted PWA can see your files.

## Seats

| Seat | This PR | Notes |
|------|---------|--------|
| **Laptop (primary)** | Localhost sidecar + local file pick | `http://127.0.0.1:8178/transcribe` and `/files`. Intended future home: **Tauri shell** on the same ports (SOW separate). |
| **Phone** | Follow-on — document only | **Separate on-device** STT (WASM / OS speech) + share-sheet / photo picker. Does **not** call the laptop. Do not block merge on a phone app. |

Do **not** promise arbitrary filesystem access from hosted `.com`. Do not add a paid mesh VPN. The phone seat does not use the laptop sidecar.

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

## Phone (follow-on seat — not this PR)

Phone is a **yes**, as a later seat. It is **not** a laptop remote and it is **not** a merge blocker.

| Phone capability | Later seat | This PR |
|------------------|------------|---------|
| STT | On-device WASM (`NEXT_PUBLIC_WHISPER_ENGINE=wasm`) or OS speech | Not shipped as default; laptop uses the sidecar |
| Local photos / files | Share-sheet / photo picker on the phone | Not shipped; laptop uses **Attach via sidecar** |
| Call the laptop sidecar | No | — |

Do not block merge on a phone app. Hosted `.com` still cannot read phone disk.

## CSP / Permissions-Policy

- `connect-src` always includes loopback `8178`. An operator may pin an extra sidecar origin; cloud STT hosts are refused.
- Hugging Face weight hosts remain only for explicit WASM opt-in.
- `microphone=(self)` on `/chat` only. Camera/geo stay off.

## Not in scope

- Public marketing / pricing copy
- Cloud STT SaaS
- A paid mesh VPN or LAN-mesh requirement
- A second speech rewriter
- Promising hosted `.com` can read the phone or laptop disk
- Shipping a Tauri shell in this PR (separate SOW)
- Blocking merge on a phone app
- Phone calling the laptop sidecar

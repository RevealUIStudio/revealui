import { DEFAULT_WHISPER_FILES_URL, getPushToTalkConfig, resolveSidecarFilesUrl } from './config';
import { isAllowedWhisperEndpoint } from './policy';
import type { TranscribeFailureReason } from './types';

export interface SidecarFileRef {
  id: string;
  name: string;
  mime: string;
  href: string;
}

export type SidecarFilesFailureReason = Extract<
  TranscribeFailureReason,
  'sidecar-unavailable' | 'forbidden-endpoint' | 'invalid-response' | 'timeout' | 'too-large'
>;

export type SidecarFilesResult =
  | { ok: true; files: SidecarFileRef[] }
  | { ok: false; reason: SidecarFilesFailureReason; message: string };

export type SidecarUploadResult =
  | { ok: true; file: SidecarFileRef }
  | { ok: false; reason: SidecarFilesFailureReason; message: string };

export interface SidecarFilesOptions {
  fetch?: typeof fetch;
  url?: string;
  timeoutMs?: number;
  maxFileBytes?: number;
}

export const LOCAL_SIDECAR_FILES_FAIL_CLOSED_MESSAGE =
  'Attach via sidecar failed. Start the local sidecar at http://127.0.0.1:8178 — hosted .com cannot read your disk.';

const FORBIDDEN_MESSAGE =
  'Attach via sidecar only talks to a local sidecar. Hosted .com cannot read your disk.';

function fail(
  reason: SidecarFilesFailureReason,
  message: string,
): SidecarUploadResult & SidecarFilesResult {
  return { ok: false, reason, message };
}

function readFileRef(payload: unknown): SidecarFileRef | null {
  if (!payload || typeof payload !== 'object') return null;
  const rec = payload as Record<string, unknown>;
  const nested =
    rec.file && typeof rec.file === 'object' ? (rec.file as Record<string, unknown>) : rec;
  if (typeof nested.id !== 'string' || typeof nested.name !== 'string') return null;
  return {
    id: nested.id,
    name: nested.name,
    mime: typeof nested.mime === 'string' ? nested.mime : 'application/octet-stream',
    href: typeof nested.href === 'string' ? nested.href : '',
  };
}

function readFileList(payload: unknown): SidecarFileRef[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const rec = payload as Record<string, unknown>;
  const raw = rec.files;
  if (!Array.isArray(raw)) return null;
  const files: SidecarFileRef[] = [];
  for (const item of raw) {
    const ref = readFileRef(item);
    if (!ref) return null;
    files.push(ref);
  }
  return files;
}

function resolvedFilesUrl(options: SidecarFilesOptions): string {
  const cfg = getPushToTalkConfig();
  if (options.url && options.url.trim().length > 0) return options.url.trim();
  if (cfg.filesUrl.trim().length > 0) return cfg.filesUrl;
  return resolveSidecarFilesUrl(cfg.whisperUrl) || DEFAULT_WHISPER_FILES_URL;
}

/**
 * GET `/files` on the laptop sidecar. Hosted admin never lists OS paths.
 */
export async function listSidecarFiles(
  options: SidecarFilesOptions = {},
): Promise<SidecarFilesResult> {
  const cfg = getPushToTalkConfig();
  const url = resolvedFilesUrl(options);
  const timeoutMs = options.timeoutMs ?? cfg.timeoutMs;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!isAllowedWhisperEndpoint(url)) {
    return fail('forbidden-endpoint', FORBIDDEN_MESSAGE);
  }
  if (typeof fetchImpl !== 'function') {
    return fail('sidecar-unavailable', LOCAL_SIDECAR_FILES_FAIL_CLOSED_MESSAGE);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      return fail('sidecar-unavailable', LOCAL_SIDECAR_FILES_FAIL_CLOSED_MESSAGE);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return fail('invalid-response', 'Local sidecar returned a files list we could not read.');
    }
    const files = readFileList(payload);
    if (files === null) {
      return fail('invalid-response', 'Local sidecar returned no files list.');
    }
    return { ok: true, files };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError') {
      return fail('timeout', 'Local sidecar timed out listing files.');
    }
    return fail('sidecar-unavailable', LOCAL_SIDECAR_FILES_FAIL_CLOSED_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST a browser-picked blob to sidecar `/files`. The hosted tab never reads
 * an OS path — a future Tauri shell can own the same port.
 */
export async function uploadSidecarFile(
  file: Blob,
  options: SidecarFilesOptions = {},
): Promise<SidecarUploadResult> {
  const cfg = getPushToTalkConfig();
  const url = resolvedFilesUrl(options);
  const timeoutMs = options.timeoutMs ?? cfg.timeoutMs;
  const maxFileBytes = options.maxFileBytes ?? cfg.maxFileBytes;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!isAllowedWhisperEndpoint(url)) {
    return fail('forbidden-endpoint', FORBIDDEN_MESSAGE);
  }
  if (file.size === 0) {
    return fail('invalid-response', 'No file selected.');
  }
  if (file.size > maxFileBytes) {
    return fail('too-large', 'File is too large for the local sidecar attach path.');
  }
  if (typeof fetchImpl !== 'function') {
    return fail('sidecar-unavailable', LOCAL_SIDECAR_FILES_FAIL_CLOSED_MESSAGE);
  }

  const filename = file instanceof File && file.name.trim().length > 0 ? file.name : 'attach.bin';
  const form = new FormData();
  form.append('file', file, filename);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      return fail('sidecar-unavailable', LOCAL_SIDECAR_FILES_FAIL_CLOSED_MESSAGE);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return fail('invalid-response', 'Local sidecar returned a file response we could not read.');
    }
    const ref = readFileRef(payload);
    if (!ref) {
      return fail('invalid-response', 'Local sidecar returned no file reference.');
    }
    return { ok: true, file: ref };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError') {
      return fail('timeout', 'Local sidecar timed out storing the file.');
    }
    return fail('sidecar-unavailable', LOCAL_SIDECAR_FILES_FAIL_CLOSED_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
}

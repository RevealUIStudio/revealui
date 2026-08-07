/**
 * Admin media upload via presigned direct-to-R2 (GAP-215).
 *
 * Flow: POST /media/presign → PUT bytes to storage → POST /media/confirm.
 * The API function never buffers the file body.
 */

export interface UploadedMediaItem {
  id: string;
  filename: string;
  mimeType: string;
  filesize: number | null;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PresignResponse {
  success: boolean;
  data: {
    key: string;
    uploadUrl: string;
    headers: Record<string, string>;
    expiresAt: string;
  };
}

export interface ConfirmResponse {
  success: boolean;
  data: UploadedMediaItem;
  error?: string;
}

export type ApiFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface UploadMediaDeps {
  /** Authenticated fetch (CSRF + cookies). Defaults are injected by the page. */
  apiFetch: ApiFetch;
  /** Unauthenticated fetch for the cross-origin storage PUT (R2). */
  storageFetch?: typeof fetch;
}

/**
 * Upload a file: presign → direct PUT to object storage → confirm media row.
 */
export async function uploadMedia(
  serverUrl: string,
  file: File,
  deps: UploadMediaDeps,
  alt?: string,
): Promise<UploadedMediaItem> {
  const storageFetch = deps.storageFetch ?? fetch;

  const presignRes = await deps.apiFetch(`${serverUrl}/api/content/media/presign`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    }),
  });
  if (!presignRes.ok) {
    const body = (await presignRes.json().catch(() => ({ error: 'Presign failed' }))) as {
      error?: string;
    };
    throw new Error(body.error ?? `Presign failed: ${presignRes.status}`);
  }
  const presignJson = (await presignRes.json()) as PresignResponse;
  const { key, uploadUrl, headers } = presignJson.data;

  const putRes = await storageFetch(uploadUrl, {
    method: 'PUT',
    headers: { ...headers },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Storage upload failed: ${putRes.status}`);
  }

  const confirmRes = await deps.apiFetch(`${serverUrl}/api/content/media/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      ...(alt !== undefined ? { alt } : {}),
    }),
  });
  if (!confirmRes.ok) {
    const body = (await confirmRes.json().catch(() => ({ error: 'Confirm failed' }))) as {
      error?: string;
    };
    throw new Error(body.error ?? `Confirm failed: ${confirmRes.status}`);
  }
  const confirmJson = (await confirmRes.json()) as ConfirmResponse;
  return confirmJson.data;
}

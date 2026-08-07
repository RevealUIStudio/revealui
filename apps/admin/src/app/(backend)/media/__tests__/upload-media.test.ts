/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadMedia } from '../upload-media.js';

describe('uploadMedia (presign → PUT → confirm)', () => {
  const apiFetch = vi.fn();
  const storageFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('presigns, PUTs to storage with signed headers, then confirms', async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'photo.png', {
      type: 'image/png',
    });

    apiFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              key: 'media/11111111-1111-4111-8111-111111111111.png',
              uploadUrl: 'https://r2.example/presign?sig=1',
              headers: { 'content-type': 'image/png' },
              expiresAt: '2026-05-18T10:15:00.000Z',
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              id: 'media-1',
              filename: 'photo.png',
              mimeType: 'image/png',
              filesize: 4,
              url: 'https://media.revealui.com/media/11111111-1111-4111-8111-111111111111.png',
              alt: null,
              width: null,
              height: null,
              createdAt: '2026-05-18T10:00:00.000Z',
              updatedAt: '2026-05-18T10:00:00.000Z',
            },
          }),
          { status: 201 },
        ),
      );

    storageFetch.mockResolvedValue(new Response(null, { status: 200 }));

    const result = await uploadMedia('https://api.example', file, { apiFetch, storageFetch });

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      'https://api.example/api/content/media/presign',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          filename: 'photo.png',
          mimeType: 'image/png',
          size: 4,
        }),
      }),
    );
    expect(storageFetch).toHaveBeenCalledWith(
      'https://r2.example/presign?sig=1',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        body: file,
      }),
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.example/api/content/media/confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          key: 'media/11111111-1111-4111-8111-111111111111.png',
          filename: 'photo.png',
          mimeType: 'image/png',
          size: 4,
        }),
      }),
    );
    expect(result.id).toBe('media-1');
  });

  it('throws when presign fails', async () => {
    apiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unsupported file type' }), { status: 400 }),
    );
    const file = new File([new Uint8Array([1])], 'x.bin', { type: 'application/octet-stream' });
    await expect(
      uploadMedia('https://api.example', file, { apiFetch, storageFetch }),
    ).rejects.toThrow(/Unsupported file type/);
    expect(storageFetch).not.toHaveBeenCalled();
  });

  it('throws when the storage PUT fails', async () => {
    apiFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            key: 'media/11111111-1111-4111-8111-111111111111.png',
            uploadUrl: 'https://r2.example/presign',
            headers: { 'content-type': 'image/png' },
            expiresAt: '2026-05-18T10:15:00.000Z',
          },
        }),
        { status: 200 },
      ),
    );
    storageFetch.mockResolvedValue(new Response(null, { status: 403 }));
    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
    await expect(
      uploadMedia('https://api.example', file, { apiFetch, storageFetch }),
    ).rejects.toThrow(/Storage upload failed: 403/);
  });

  it('throws when confirm fails', async () => {
    apiFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              key: 'media/11111111-1111-4111-8111-111111111111.png',
              uploadUrl: 'https://r2.example/presign',
              headers: { 'content-type': 'image/png' },
              expiresAt: '2026-05-18T10:15:00.000Z',
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'File content does not match' }), { status: 400 }),
      );
    storageFetch.mockResolvedValue(new Response(null, { status: 200 }));
    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' });
    await expect(
      uploadMedia('https://api.example', file, { apiFetch, storageFetch }),
    ).rejects.toThrow(/does not match/);
  });
});

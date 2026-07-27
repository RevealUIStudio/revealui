// @vitest-environment jsdom
/**
 * ImageUploadButton mutation-sensitive regression test
 *
 * upload.test.ts's "required alt field" suite (see formDataFor() in that
 * file) rebuilds its own FormData rather than exercising
 * ImageUploadButton.tsx's actual handleFileSelect handler, so deleting the
 * `formData.append('alt', altText)` line there leaves the whole suite green
 * (reviewer finding on PR #2230). This test mounts the real component,
 * drives a real file-input change event, and inspects the FormData the
 * component itself builds and hands to postMediaUpload - so removing that
 * line fails it.
 */

import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageUploadButton } from '../ImageUploadButton.js';
import { deriveAltTextFromFilename, postMediaUpload } from '../upload.js';

vi.mock('../upload.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../upload.js')>();
  return {
    ...actual,
    postMediaUpload: vi.fn(),
  };
});

/** jsdom has no image decoder - fire `onload` as soon as `src` is set. */
class StubImage {
  width = 400;
  height = 300;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  #src = '';

  get src(): string {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    queueMicrotask(() => this.onload?.());
  }
}

function renderUploadButton(): void {
  render(
    <LexicalComposer
      initialConfig={{
        namespace: 'test',
        onError: (error) => {
          throw error;
        },
      }}
    >
      <ImageUploadButton />
    </LexicalComposer>,
  );
}

describe('ImageUploadButton - alt field mutation guard', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', StubImage);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue('blob:test'),
      revokeObjectURL: vi.fn(),
    });
    (postMediaUpload as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://example.com/uploads/company-logo.png' }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the derived alt text in the FormData posted to postMediaUpload', async () => {
    renderUploadButton();

    const input = screen.getByLabelText('Upload image') as HTMLInputElement;
    const file = new File(['binary-image-data'], 'company-logo.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(postMediaUpload).toHaveBeenCalledTimes(1));

    const formData = (postMediaUpload as Mock).mock.calls[0]?.[1] as FormData;
    expect(formData.get('alt')).toBe(deriveAltTextFromFilename('company-logo.png'));
  });
});

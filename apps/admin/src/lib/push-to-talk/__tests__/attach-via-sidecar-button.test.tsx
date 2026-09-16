import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttachViaSidecarButton } from '../AttachViaSidecarButton';
import { insertLocalFileRef } from '../insert';

afterEach(() => {
  cleanup();
});

describe('AttachViaSidecarButton', () => {
  it('defaults to idle attach-via-sidecar and does not claim hosted disk', () => {
    render(<AttachViaSidecarButton onAttached={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Attach via sidecar' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uploads the picked file to the sidecar and inserts a local ref', async () => {
    const onAttached = vi.fn();
    let composer = '';

    render(
      <AttachViaSidecarButton
        onAttached={(file) => {
          composer = insertLocalFileRef(composer, file.name);
          onAttached(file);
        }}
        upload={async () => ({
          ok: true,
          file: { id: '1', name: 'deck.png', mime: 'image/png', href: '/files/1' },
        })}
      />,
    );

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(['img'], 'deck.png', { type: 'image/png' });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => {
      expect(onAttached).toHaveBeenCalledWith({
        id: '1',
        name: 'deck.png',
        mime: 'image/png',
        href: '/files/1',
      });
    });
    expect(composer).toBe('[local file: deck.png]');
  });

  it('fail-closes with a sidecar-missing alert when /files is down', async () => {
    const onAttached = vi.fn();

    render(
      <AttachViaSidecarButton
        onAttached={onAttached}
        upload={async () => ({
          ok: false,
          reason: 'sidecar-unavailable',
          message: 'Attach via sidecar failed. Start the local sidecar.',
        })}
      />,
    );

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Attach via sidecar failed. Start the local sidecar.',
    );
    expect(onAttached).not.toHaveBeenCalled();
  });
});

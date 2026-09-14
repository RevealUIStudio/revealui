import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertTranscript } from '../insert';
import { PushToTalkButton } from '../PushToTalkButton';
import type { MediaRecorderLike } from '../use-push-to-talk';

afterEach(() => {
  cleanup();
});

function fakeStream(): MediaStream {
  return {
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream;
}

function createFakeRecorder(): MediaRecorderLike {
  return {
    state: 'inactive',
    ondataavailable: null,
    onstop: null,
    onerror: null,
    start() {
      this.state = 'recording';
    },
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['speech'], { type: 'audio/webm' }) });
      this.onstop?.();
    },
  };
}

describe('PushToTalkButton', () => {
  it('defaults to mic off and labels hold-to-talk', () => {
    render(<PushToTalkButton onTranscript={() => undefined} />);

    const button = screen.getByRole('button', { name: 'Hold to talk' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button.className).toContain('min-h-14');
    expect(button.className).toContain('w-full');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('inserts the local Whisper transcript into the composer callback and does not auto-send', async () => {
    const onTranscript = vi.fn();
    let composer = '';

    render(
      <PushToTalkButton
        onTranscript={(text) => {
          composer = insertTranscript(composer, text);
          onTranscript(text);
        }}
        deps={{
          getUserMedia: async () => fakeStream(),
          createRecorder: () => createFakeRecorder(),
          transcribe: async () => ({ ok: true, text: 'List all users' }),
        }}
      />,
    );

    const button = screen.getByRole('button', { name: 'Hold to talk' });
    fireEvent.pointerDown(button, { button: 0, pointerId: 1 });
    expect(await screen.findByRole('button', { name: /Listening/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.pointerUp(button, { button: 0, pointerId: 1 });

    await waitFor(() => {
      expect(onTranscript).toHaveBeenCalledWith('List all users');
    });
    expect(composer).toBe('List all users');
    expect(onTranscript).toHaveBeenCalledTimes(1);
  });

  it('fail-closes with a sidecar-missing alert when Whisper is down', async () => {
    const onTranscript = vi.fn();

    render(
      <PushToTalkButton
        onTranscript={onTranscript}
        deps={{
          getUserMedia: async () => fakeStream(),
          createRecorder: () => createFakeRecorder(),
          transcribe: async () => ({
            ok: false,
            reason: 'sidecar-unavailable',
            message: 'Local Whisper sidecar is not running.',
          }),
        }}
      />,
    );

    const button = screen.getByRole('button', { name: 'Hold to talk' });
    fireEvent.pointerDown(button, { button: 0, pointerId: 1 });
    await screen.findByRole('button', { name: /Listening/ });
    fireEvent.pointerUp(button, { button: 0, pointerId: 1 });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Local Whisper sidecar is not running.',
    );
    expect(onTranscript).not.toHaveBeenCalled();
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('inserts the local Whisper transcript into the composer callback and does not auto-send', async () => {
    const user = userEvent.setup();
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
    await user.pointer({ keys: '[MouseLeft>]', target: button });
    expect(await screen.findByRole('button', { name: /Listening/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.pointer({ keys: '[/MouseLeft]', target: button });

    expect(onTranscript).toHaveBeenCalledWith('List all users');
    expect(composer).toBe('List all users');
    expect(onTranscript).toHaveBeenCalledTimes(1);
  });

  it('fail-closes with a sidecar-missing alert when Whisper is down', async () => {
    const user = userEvent.setup();
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
    await user.pointer({ keys: '[MouseLeft>]', target: button });
    await user.pointer({ keys: '[/MouseLeft]', target: button });

    expect(onTranscript).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Local Whisper sidecar is not running.',
    );
  });
});

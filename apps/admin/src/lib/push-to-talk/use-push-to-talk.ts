'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { type TranscribeResult, transcribeLocalWhisper } from './client';
import { getPushToTalkConfig } from './config';

export type PushToTalkStatus = 'idle' | 'recording' | 'transcribing' | 'error';

export interface MediaRecorderLike {
  start: () => void;
  stop: () => void;
  state: 'inactive' | 'recording' | 'paused';
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((event: { error?: Error }) => void) | null;
}

export interface PushToTalkDependencies {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createRecorder?: (stream: MediaStream, mimeType: string) => MediaRecorderLike;
  transcribe?: (audio: Blob) => Promise<TranscribeResult>;
}

export interface UsePushToTalkResult {
  status: PushToTalkStatus;
  errorMessage: string | null;
  isRecording: boolean;
  startHold: () => Promise<void>;
  endHold: () => Promise<string | null>;
  clearError: () => void;
}

const MIC_PERMISSION_MESSAGE =
  'Microphone permission is required. Push-to-talk stays off until you allow it.';

const MIC_UNSUPPORTED_MESSAGE = 'This browser cannot capture the microphone for push-to-talk.';

function defaultGetUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const media = globalThis.navigator?.mediaDevices;
  if (!media?.getUserMedia) {
    return Promise.reject(new Error(MIC_UNSUPPORTED_MESSAGE));
  }
  return media.getUserMedia(constraints);
}

function defaultCreateRecorder(stream: MediaStream, mimeType: string): MediaRecorderLike {
  const Ctor = (
    globalThis as {
      MediaRecorder?: (new (
        s: MediaStream,
        opts?: { mimeType?: string },
      ) => MediaRecorder) & {
        isTypeSupported?: (type: string) => boolean;
      };
    }
  ).MediaRecorder;
  if (!Ctor) {
    throw new Error(MIC_UNSUPPORTED_MESSAGE);
  }
  const options = Ctor.isTypeSupported?.(mimeType) ? { mimeType } : undefined;
  return new Ctor(stream, options);
}

function stopTracks(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export function usePushToTalk(deps: PushToTalkDependencies = {}): UsePushToTalkResult {
  const [status, setStatus] = useState<PushToTalkStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorderLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const holdGenerationRef = useRef(0);

  const transcribe = deps.transcribe ?? transcribeLocalWhisper;
  const getUserMedia = deps.getUserMedia ?? defaultGetUserMedia;
  const createRecorder = deps.createRecorder ?? defaultCreateRecorder;

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setStatus((current) => (current === 'error' ? 'idle' : current));
  }, []);

  const startHold = useCallback(async (): Promise<void> => {
    if (status === 'recording' || status === 'transcribing') return;

    setErrorMessage(null);
    chunksRef.current = [];
    const generation = ++holdGenerationRef.current;

    try {
      const stream = await getUserMedia({ audio: true, video: false });
      if (generation !== holdGenerationRef.current) {
        stopTracks(stream);
        return;
      }

      const mimeType = getPushToTalkConfig().mimeType;
      const recorder = createRecorder(stream, mimeType);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        stopTracks(stream);
        streamRef.current = null;
        recorderRef.current = null;
        setStatus('error');
        setErrorMessage('Microphone capture failed. Push-to-talk is off.');
      };

      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
    } catch (error) {
      stopTracks(streamRef.current);
      streamRef.current = null;
      recorderRef.current = null;
      setStatus('error');
      const message = error instanceof Error ? error.message : MIC_PERMISSION_MESSAGE;
      setErrorMessage(
        message === MIC_UNSUPPORTED_MESSAGE ? MIC_UNSUPPORTED_MESSAGE : MIC_PERMISSION_MESSAGE,
      );
    }
  }, [createRecorder, getUserMedia, status]);

  const endHold = useCallback(async (): Promise<string | null> => {
    holdGenerationRef.current += 1;
    const recorder = recorderRef.current;
    const stream = streamRef.current;

    if (!recorder || recorder.state === 'inactive') {
      stopTracks(stream);
      streamRef.current = null;
      recorderRef.current = null;
      if (status === 'recording') setStatus('idle');
      return null;
    }

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const type = chunksRef.current[0]?.type || getPushToTalkConfig().mimeType;
        resolve(new Blob(chunksRef.current, { type }));
      };
      recorder.stop();
    });

    stopTracks(stream);
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];

    setStatus('transcribing');
    const result = await transcribe(blob);
    if (!result.ok) {
      setStatus('error');
      setErrorMessage(result.message);
      return null;
    }

    const text = result.text.trim();
    setStatus('idle');
    if (text.length === 0) return null;
    return text;
  }, [status, transcribe]);

  return useMemo(
    () => ({
      status,
      errorMessage,
      isRecording: status === 'recording',
      startHold,
      endHold,
      clearError,
    }),
    [clearError, endHold, errorMessage, startHold, status],
  );
}

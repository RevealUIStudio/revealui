/**
 * Regression coverage for the page-wide drag capture fix (owner report:
 * dropping an image outside the media page's DropZone navigated the whole
 * tab to the raw file and the in-progress edit was lost).
 *
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWindowFileDrop } from '../use-window-file-drop';

function makeFileList(count: number): FileList {
  const files = Array.from(
    { length: count },
    (_, i) => new File([`data-${i}`], `file-${i}.png`, { type: 'image/png' }),
  );
  const indexed: Record<number, File> = {};
  for (const [index, file] of files.entries()) {
    indexed[index] = file;
  }
  return {
    ...indexed,
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* iterate() {
      yield* files;
    },
  } as unknown as FileList;
}

function dispatchDrag(type: string, opts: { hasFiles?: boolean; fileCount?: number } = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    configurable: true,
    value: {
      types: opts.hasFiles === false ? [] : ['Files'],
      files: makeFileList(opts.fileCount ?? 1),
    },
  });
  window.dispatchEvent(event);
  return event;
}

describe('useWindowFileDrop', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preventDefaults dragover unconditionally, so a stray drop can never navigate the tab', () => {
    const onFiles = vi.fn();
    renderHook(() => useWindowFileDrop({ uploading: false, onFiles }));

    const event = dispatchDrag('dragover');
    expect(event.defaultPrevented).toBe(true);
  });

  it('preventDefaults drop and routes the dropped files to onFiles', () => {
    const onFiles = vi.fn();
    renderHook(() => useWindowFileDrop({ uploading: false, onFiles }));

    const event = dispatchDrag('drop', { fileCount: 2 });
    expect(event.defaultPrevented).toBe(true);
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it('still preventDefaults drop while uploading, but ignores the drop (no double-upload)', () => {
    const onFiles = vi.fn();
    renderHook(() => useWindowFileDrop({ uploading: true, onFiles }));

    const event = dispatchDrag('drop', { fileCount: 1 });
    expect(event.defaultPrevented).toBe(true);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('surfaces the drag-active overlay flag once a file drag enters the window, and clears it on drop', () => {
    const onFiles = vi.fn();
    const { result } = renderHook(() => useWindowFileDrop({ uploading: false, onFiles }));

    expect(result.current.isDraggingFiles).toBe(false);

    act(() => {
      dispatchDrag('dragenter');
    });
    expect(result.current.isDraggingFiles).toBe(true);

    act(() => {
      dispatchDrag('drop', { fileCount: 1 });
    });
    expect(result.current.isDraggingFiles).toBe(false);
  });

  it('clears the overlay flag on dragleave', () => {
    const onFiles = vi.fn();
    const { result } = renderHook(() => useWindowFileDrop({ uploading: false, onFiles }));

    act(() => {
      dispatchDrag('dragenter');
    });
    expect(result.current.isDraggingFiles).toBe(true);

    act(() => {
      dispatchDrag('dragleave');
    });
    expect(result.current.isDraggingFiles).toBe(false);
  });

  it('never raises the overlay while an upload is already in flight', () => {
    const onFiles = vi.fn();
    const { result } = renderHook(() => useWindowFileDrop({ uploading: true, onFiles }));

    act(() => {
      dispatchDrag('dragenter');
    });
    expect(result.current.isDraggingFiles).toBe(false);
  });

  it('ignores drag events whose dataTransfer carries no files', () => {
    const onFiles = vi.fn();
    const { result } = renderHook(() => useWindowFileDrop({ uploading: false, onFiles }));

    act(() => {
      dispatchDrag('dragenter', { hasFiles: false });
    });
    expect(result.current.isDraggingFiles).toBe(false);
  });

  it('removes all window listeners on unmount', () => {
    const onFiles = vi.fn();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useWindowFileDrop({ uploading: false, onFiles }));
    const addedTypes = addSpy.mock.calls.map((call) => call[0]);

    unmount();
    const removedTypes = removeSpy.mock.calls.map((call) => call[0]);

    for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      expect(addedTypes).toContain(type);
      expect(removedTypes).toContain(type);
    }
  });
});

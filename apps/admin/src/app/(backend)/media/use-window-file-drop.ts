'use client';

import { useEffect, useState } from 'react';

interface UseWindowFileDropOptions {
  /** While true, drops are captured (preventDefault still fires) but never routed to `onFiles`. */
  uploading: boolean;
  onFiles: (files: FileList) => void;
}

interface UseWindowFileDropResult {
  /** True while a file drag is over the window and should show the full-page overlay. */
  isDraggingFiles: boolean;
}

function dragCarriesFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  for (const type of types) {
    if (type === 'Files') return true;
  }
  return false;
}

/**
 * Captures drag-and-drop at the window level so a file dropped anywhere on
 * the media page  -  not just the in-page DropZone  -  never falls through to
 * the browser default of navigating the tab to the raw file. `dragover` and
 * `drop` always call preventDefault, unconditionally, so navigation can never
 * happen regardless of upload state. File routing (and the drag-active
 * overlay) are suppressed while an upload is already in flight.
 */
export function useWindowFileDrop({
  uploading,
  onFiles,
}: UseWindowFileDropOptions): UseWindowFileDropResult {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  useEffect(() => {
    let dragDepth = 0;

    function handleDragEnter(event: DragEvent) {
      if (!dragCarriesFiles(event)) return;
      event.preventDefault();
      dragDepth += 1;
      if (!uploading) setIsDraggingFiles(true);
    }

    function handleDragOver(event: DragEvent) {
      event.preventDefault();
    }

    function handleDragLeave(event: DragEvent) {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setIsDraggingFiles(false);
    }

    function handleDrop(event: DragEvent) {
      event.preventDefault();
      dragDepth = 0;
      setIsDraggingFiles(false);
      if (uploading) return;
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) onFiles(files);
    }

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [uploading, onFiles]);

  return { isDraggingFiles };
}

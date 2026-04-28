'use client';

import { useCallback, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MediaItem {
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

interface MediaListResponse {
  success: boolean;
  data: MediaItem[];
  totalDocs: number;
  totalPages: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return ' - ';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchMedia(
  serverUrl: string,
  options: { limit: number; offset: number; mimeType?: string },
): Promise<MediaListResponse> {
  const params = new URLSearchParams({
    limit: String(options.limit),
    offset: String(options.offset),
  });
  if (options.mimeType) params.set('mimeType', options.mimeType);
  const res = await fetch(`${serverUrl}/api/content/media?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);
  return res.json();
}

async function uploadMedia(serverUrl: string, file: File, alt?: string): Promise<MediaItem> {
  const formData = new FormData();
  formData.append('file', file);
  if (alt) formData.append('alt', alt);
  const res = await fetch(`${serverUrl}/api/content/media`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(body.error ?? `Upload failed: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

async function deleteMediaItem(serverUrl: string, id: string): Promise<void> {
  const res = await fetch(`${serverUrl}/api/content/media/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function DropZone({
  onFiles,
  uploading,
}: {
  onFiles: (files: FileList) => void;
  uploading: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    // biome-ignore lint/a11y/useSemanticElements: drop zone needs div for drag events
    <div
      role="button"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
        dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 hover:border-zinc-500'
      } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      tabIndex={0}
    >
      <svg
        className="mb-2 h-8 w-8 text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <title>Upload</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>
      <p className="text-sm text-zinc-400">
        {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
      </p>
      <p className="mt-1 text-xs text-zinc-600">JPEG, PNG, WebP, GIF</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}

function MediaCard({
  item,
  onDelete,
  onPreview,
}: {
  item: MediaItem;
  onDelete: (id: string) => void;
  onPreview: (item: MediaItem) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-600">
      <button type="button" onClick={() => onPreview(item)} className="block w-full">
        <div className="flex h-40 items-center justify-center bg-zinc-950">
          {isImage(item.mimeType) ? (
            // biome-ignore lint/performance/noImgElement: external Blob URLs  -  next/image requires configured domains
            <img
              src={item.url}
              alt={item.alt ?? item.filename}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <svg
              className="h-12 w-12 text-zinc-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
              aria-hidden="true"
            >
              <title>File</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          )}
        </div>
      </button>
      <div className="p-3">
        <p className="truncate text-sm font-medium text-white" title={item.filename}>
          {item.filename}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {item.mimeType.split('/')[1]?.toUpperCase()} · {formatBytes(item.filesize)}
        </p>
      </div>
      <button
        type="button"
        onClick={async () => {
          setDeleting(true);
          try {
            onDelete(item.id);
          } finally {
            setDeleting(false);
          }
        }}
        disabled={deleting}
        className="absolute top-2 right-2 rounded-full bg-zinc-900/80 p-1.5 text-zinc-400 opacity-0 backdrop-blur transition-opacity hover:text-red-400 group-hover:opacity-100"
        aria-label={`Delete ${item.filename}`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <title>Delete</title>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function PreviewModal({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handler is on the child dialog
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${item.filename}`}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: click stops propagation to backdrop */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: modal content panel needs click stop-propagation */}
      <div
        className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-zinc-900 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-full bg-zinc-800 p-1.5 text-zinc-400 hover:text-white"
          aria-label="Close preview"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>Close</title>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {isImage(item.mimeType) ? (
          // biome-ignore lint/performance/noImgElement: external Blob URLs
          <img
            src={item.url}
            alt={item.alt ?? item.filename}
            className="max-h-[80vh] max-w-full rounded object-contain"
          />
        ) : (
          <div className="flex h-64 w-96 items-center justify-center text-zinc-500">
            File preview not available
          </div>
        )}
        <div className="mt-4 space-y-1 text-sm">
          <p className="font-medium text-white">{item.filename}</p>
          <p className="text-zinc-400">
            {item.mimeType} · {formatBytes(item.filesize)}
            {item.width != null && item.height != null && ` · ${item.width}x${item.height}`}
          </p>
          {item.alt && <p className="text-zinc-500">Alt: {item.alt}</p>}
          <p className="text-zinc-600">Uploaded {new Date(item.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MediaLibraryPage() {
  const serverUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [filter, setFilter] = useState<string>('');

  const limit = 24;
  const loadedRef = useRef(false);

  const loadMedia = useCallback(
    async (pageNum: number, mimeFilter?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchMedia(serverUrl, {
          limit,
          offset: pageNum * limit,
          mimeType: mimeFilter || undefined,
        });
        setItems(res.data);
        setTotalDocs(res.totalDocs);
        setTotalPages(res.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load media');
      } finally {
        setLoading(false);
      }
    },
    [serverUrl],
  );

  // Initial load
  if (!loadedRef.current) {
    loadedRef.current = true;
    loadMedia(0);
  }

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadMedia(serverUrl, file);
      }
      await loadMedia(page, filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMediaItem(serverUrl, id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotalDocs((prev) => prev - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleFilterChange = (mimeType: string) => {
    setFilter(mimeType);
    setPage(0);
    loadMedia(0, mimeType);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadMedia(newPage, filter);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Media Library</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {totalDocs} {totalDocs === 1 ? 'file' : 'files'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white"
          >
            <option value="">All types</option>
            <option value="image/jpeg">JPEG</option>
            <option value="image/png">PNG</option>
            <option value="image/webp">WebP</option>
            <option value="image/gif">GIF</option>
          </select>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400"
          role="alert"
        >
          {error}
        </div>
      )}

      <DropZone onFiles={handleUpload} uploading={uploading} />

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable ID
              key={`skeleton-${i}`}
              className="h-52 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 py-16">
          <svg
            className="mb-3 h-12 w-12 text-zinc-700"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
            strokeWidth={1}
            stroke="currentColor"
          >
            <title>No media</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
          <p className="text-sm text-zinc-500">No media files yet</p>
          <p className="mt-1 text-xs text-zinc-600">Upload images to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} onDelete={handleDelete} onPreview={setPreview} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
          <p className="text-sm text-zinc-500">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {preview && <PreviewModal item={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

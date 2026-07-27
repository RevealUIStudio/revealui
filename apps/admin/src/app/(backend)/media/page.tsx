'use client';

import {
  Button,
  EmptyState,
  IconClose,
  IconTrash,
  IconUpload,
  InputCVA,
  Skeleton,
} from '@revealui/presentation';
import {
  SelectCVA as Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@revealui/presentation/client';
import { type ChangeEvent, useCallback, useRef, useState } from 'react';
import { apiFetch } from '@/lib/utils/csrf';
import { useWindowFileDrop } from './use-window-file-drop.js';

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
  const res = await apiFetch(`${serverUrl}/api/content/media`, {
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
  const res = await apiFetch(`${serverUrl}/api/content/media/${id}`, {
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
        // The page-level capture (use-window-file-drop.ts) also listens on
        // window for stray drops; stop here so an in-zone drop doesn't fire
        // onFiles twice.
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors sm:p-12 ${
        dragOver ? 'border-primary bg-primary/10' : 'border-border hover:border-ring hover:bg-card'
      } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      tabIndex={0}
    >
      <span
        className={`flex size-14 items-center justify-center rounded-full transition-colors ${
          dragOver ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
        }`}
      >
        <IconUpload className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-medium text-foreground">
        {uploading ? 'Uploading...' : 'Drop images to upload'}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {uploading ? 'Hang tight, this only takes a moment.' : 'or click to browse your files'}
      </p>
      <p className="mt-3 font-mono text-xs text-muted-foreground">JPEG · PNG · WebP · GIF</p>
      <InputCVA
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (e.target.files && e.target.files.length > 0) {
            onFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}

function DragOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-card px-14 py-12 shadow-lg">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <IconUpload className="size-7" aria-hidden="true" />
        </span>
        <p className="text-lg font-semibold text-foreground">Drop to upload</p>
        <p className="text-sm text-muted-foreground">Release anywhere on this page</p>
      </div>
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
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-ring hover:shadow-md">
      <Button
        type="button"
        appearance="ghost"
        variant="neutral"
        onClick={() => onPreview(item)}
        className="block h-auto w-full rounded-none p-0"
      >
        <div className="flex h-40 items-center justify-center bg-muted">
          {isImage(item.mimeType) ? (
            // biome-ignore lint/performance/noImgElement: external Blob URLs  -  next/image requires configured domains
            <img
              src={item.url}
              alt={item.alt ?? item.filename}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <span className="px-2 text-center text-xs text-muted-foreground">
              {item.mimeType.split('/')[1]?.toUpperCase() ?? 'FILE'}
            </span>
          )}
        </div>
      </Button>
      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-medium text-foreground" title={item.filename}>
          {item.filename}
        </p>
        {item.alt && (
          <p className="truncate text-xs text-muted-foreground" title={item.alt}>
            Alt: {item.alt}
          </p>
        )}
        <p className="font-mono text-xs text-muted-foreground">
          {item.mimeType.split('/')[1]?.toUpperCase()} · {formatBytes(item.filesize)}
        </p>
      </div>
      <Button
        type="button"
        appearance="ghost"
        variant="neutral"
        size="icon"
        onClick={async () => {
          setDeleting(true);
          try {
            onDelete(item.id);
          } finally {
            setDeleting(false);
          }
        }}
        disabled={deleting}
        className="absolute top-2 right-2 size-8 rounded-full border border-border bg-card/90 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition-all hover:border-error/40 hover:bg-error/10 hover:text-error focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
        aria-label={`Delete ${item.filename}`}
      >
        <IconTrash className="size-4" aria-hidden="true" />
      </Button>
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
        className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-xl border border-border bg-popover p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          appearance="ghost"
          variant="neutral"
          size="icon"
          onClick={onClose}
          className="absolute top-3 right-3 size-8 rounded-full border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Close preview"
        >
          <IconClose className="size-5" aria-hidden="true" />
        </Button>
        {isImage(item.mimeType) ? (
          // biome-ignore lint/performance/noImgElement: external Blob URLs
          <img
            src={item.url}
            alt={item.alt ?? item.filename}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-64 w-96 items-center justify-center text-muted-foreground">
            File preview not available
          </div>
        )}
        <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
          <p className="font-medium text-foreground">{item.filename}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {item.mimeType} · {formatBytes(item.filesize)}
            {item.width != null && item.height != null && ` · ${item.width}x${item.height}`}
          </p>
          {item.alt && <p className="text-muted-foreground">Alt: {item.alt}</p>}
          <p className="text-xs text-muted-foreground">
            Uploaded {new Date(item.createdAt).toLocaleDateString()}
          </p>
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

  const handleUpload = useCallback(
    async (files: FileList) => {
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
    },
    [serverUrl, loadMedia, page, filter],
  );

  // Page-wide drag capture (owner report: a stray drop outside the DropZone
  // navigated the whole tab to the raw image file and the in-progress edit
  // was lost). Always preventDefaults window dragover/drop; routes dropped
  // files to the same upload handler the DropZone uses.
  const { isDraggingFiles } = useWindowFileDrop({ uploading, onFiles: handleUpload });

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
      {isDraggingFiles && <DragOverlay />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Media Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalDocs} {totalDocs === 1 ? 'file' : 'files'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={filter === '' ? 'all' : filter}
            onValueChange={(value) => handleFilterChange(value === 'all' ? '' : value)}
          >
            <SelectTrigger className="h-9 w-auto min-w-32" aria-label="Filter by media type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="image/jpeg">JPEG</SelectItem>
              <SelectItem value="image/png">PNG</SelectItem>
              <SelectItem value="image/webp">WebP</SelectItem>
              <SelectItem value="image/gif">GIF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <DropZone onFiles={handleUpload} uploading={uploading} />

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable ID
              key={`skeleton-${i}`}
              className="h-52 rounded-xl border border-border"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IconUpload className="size-6" aria-hidden="true" />}
          title="No media files yet"
          description="Upload images to get started"
          className="border-solid py-16"
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} onDelete={handleDelete} onPreview={setPreview} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              appearance="outline"
              variant="neutral"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              type="button"
              appearance="outline"
              variant="neutral"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {preview && <PreviewModal item={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

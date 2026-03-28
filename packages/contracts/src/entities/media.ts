/**
 * Media Entity Contract
 *
 * Manages file uploads with metadata, image dimensions, focal points, and thumbnails.
 * Media files are stored in Vercel Blob or other storage providers with rich metadata
 * for responsive images, accessibility, and content management.
 *
 * Business Rules:
 * - MIME type validation for security
 * - Image dimensions required for images
 * - Focal point for smart cropping (0-1 coordinates)
 * - Multiple sizes/thumbnails generated for responsive images
 * - Alt text required for accessibility
 * - Uploaded by tracks user ownership
 * - Cascading null on user deletion
 */

import { z } from 'zod/v4';

// =============================================================================
// Constants
// =============================================================================

export const MEDIA_SCHEMA_VERSION = 1;

// Supported MIME types
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/ogg'] as const;

export const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'] as const;

export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const ALL_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  ...AUDIO_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
] as const;

export type MimeType = (typeof ALL_MIME_TYPES)[number];

// Media type categories
export const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'other'] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

// File size limits (bytes)
export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  VIDEO: 100 * 1024 * 1024, // 100MB
  AUDIO: 20 * 1024 * 1024, // 20MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  DEFAULT: 10 * 1024 * 1024, // 10MB
} as const;

// Image dimension limits
export const IMAGE_LIMITS = {
  MIN_WIDTH: 1,
  MIN_HEIGHT: 1,
  MAX_WIDTH: 10000,
  MAX_HEIGHT: 10000,
} as const;

// Focal point constraints
export const FOCAL_POINT_LIMITS = {
  MIN: 0,
  MAX: 1,
} as const;

// =============================================================================
// Base Schemas
// =============================================================================

/**
 * Focal point schema (normalized coordinates 0-1)
 */
export const FocalPointSchema = z.object({
  x: z.number().min(FOCAL_POINT_LIMITS.MIN).max(FOCAL_POINT_LIMITS.MAX),
  y: z.number().min(FOCAL_POINT_LIMITS.MIN).max(FOCAL_POINT_LIMITS.MAX),
});

export type FocalPoint = z.infer<typeof FocalPointSchema>;

/**
 * Image size/thumbnail schema
 */
export const ImageSizeSchema = z.object({
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  url: z.string().url(),
  filesize: z.number().int().optional(),
});

export type ImageSize = z.infer<typeof ImageSizeSchema>;

// =============================================================================
// Base Media Schema
// =============================================================================

/**
 * Media object schema
 */
export const MediaObjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.string().default(String(MEDIA_SCHEMA_VERSION)),
  filename: z.string().min(1, 'Filename is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  filesize: z.number().int().positive().nullable().optional(),
  url: z.string().url('URL must be valid'),
  alt: z.string().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  focalPoint: FocalPointSchema.nullable().optional(),
  sizes: z.array(ImageSizeSchema).nullable().optional(),
  uploadedBy: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Media schema with validation rules
 */
export const MediaBaseSchema = MediaObjectSchema.refine(
  (data) => {
    // Images must have dimensions
    if (isImageMimeType(data.mimeType)) {
      return data.width !== null && data.height !== null;
    }
    return true;
  },
  {
    message: 'Images must have width and height',
    path: ['width'],
  },
)
  .refine(
    (data) => {
      // Validate dimensions are within limits
      if (data.width !== null && data.width !== undefined) {
        return data.width >= IMAGE_LIMITS.MIN_WIDTH && data.width <= IMAGE_LIMITS.MAX_WIDTH;
      }
      return true;
    },
    {
      message: `Width must be between ${IMAGE_LIMITS.MIN_WIDTH} and ${IMAGE_LIMITS.MAX_WIDTH}`,
      path: ['width'],
    },
  )
  .refine(
    (data) => {
      // Validate dimensions are within limits
      if (data.height !== null && data.height !== undefined) {
        return data.height >= IMAGE_LIMITS.MIN_HEIGHT && data.height <= IMAGE_LIMITS.MAX_HEIGHT;
      }
      return true;
    },
    {
      message: `Height must be between ${IMAGE_LIMITS.MIN_HEIGHT} and ${IMAGE_LIMITS.MAX_HEIGHT}`,
      path: ['height'],
    },
  );

export const MediaSchema = MediaBaseSchema;

// =============================================================================
// Insert Schema
// =============================================================================

/**
 * Schema for creating new media
 */
export const MediaInsertSchema = MediaObjectSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type Media = z.infer<typeof MediaSchema>;
export type MediaInsert = z.infer<typeof MediaInsertSchema>;

// =============================================================================
// MIME Type Helpers
// =============================================================================

/**
 * Check if MIME type is an image
 */
export function isImageMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.includes(mimeType as (typeof IMAGE_MIME_TYPES)[number]);
}

/**
 * Check if MIME type is a video
 */
export function isVideoMimeType(mimeType: string): boolean {
  return VIDEO_MIME_TYPES.includes(mimeType as (typeof VIDEO_MIME_TYPES)[number]);
}

/**
 * Check if MIME type is audio
 */
export function isAudioMimeType(mimeType: string): boolean {
  return AUDIO_MIME_TYPES.includes(mimeType as (typeof AUDIO_MIME_TYPES)[number]);
}

/**
 * Check if MIME type is a document
 */
export function isDocumentMimeType(mimeType: string): boolean {
  return DOCUMENT_MIME_TYPES.includes(mimeType as (typeof DOCUMENT_MIME_TYPES)[number]);
}

/**
 * Get media type from MIME type
 */
export function getMediaType(mimeType: string): MediaType {
  if (isImageMimeType(mimeType)) return 'image';
  if (isVideoMimeType(mimeType)) return 'video';
  if (isAudioMimeType(mimeType)) return 'audio';
  if (isDocumentMimeType(mimeType)) return 'document';
  return 'other';
}

/**
 * Check if MIME type is allowed
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return ALL_MIME_TYPES.includes(mimeType as MimeType);
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? (parts[parts.length - 1]?.toLowerCase() ?? '') : '';
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(extension: string): string | null {
  const ext = extension.toLowerCase();
  const mimeTypeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeTypeMap[ext] ?? null;
}

// =============================================================================
// Media Type Helpers
// =============================================================================

/**
 * Check if media is an image
 */
export function isImage(media: Media): boolean {
  return isImageMimeType(media.mimeType);
}

/**
 * Check if media is a video
 */
export function isVideo(media: Media): boolean {
  return isVideoMimeType(media.mimeType);
}

/**
 * Check if media is audio
 */
export function isAudio(media: Media): boolean {
  return isAudioMimeType(media.mimeType);
}

/**
 * Check if media is a document
 */
export function isDocument(media: Media): boolean {
  return isDocumentMimeType(media.mimeType);
}

// =============================================================================
// Dimension Helpers
// =============================================================================

/**
 * Check if media has dimensions
 */
export function hasDimensions(media: Media): boolean {
  return (
    media.width !== null &&
    media.width !== undefined &&
    media.height !== null &&
    media.height !== undefined
  );
}

/**
 * Get aspect ratio
 */
export function getAspectRatio(media: Media): number | null {
  if (!hasDimensions(media)) return null;
  return (media.width ?? 1) / (media.height ?? 1);
}

/**
 * Check if image is landscape
 */
export function isLandscape(media: Media): boolean {
  const ratio = getAspectRatio(media);
  return ratio !== null && ratio > 1;
}

/**
 * Check if image is portrait
 */
export function isPortrait(media: Media): boolean {
  const ratio = getAspectRatio(media);
  return ratio !== null && ratio < 1;
}

/**
 * Check if image is square
 */
export function isSquare(media: Media): boolean {
  const ratio = getAspectRatio(media);
  return ratio !== null && Math.abs(ratio - 1) < 0.01;
}

/**
 * Calculate scaled dimensions
 */
export function calculateScaledDimensions(
  media: Media,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } | null {
  if (!hasDimensions(media)) return null;

  const width = media.width ?? 0;
  const height = media.height ?? 0;
  const ratio = width / height;

  let newWidth = width;
  let newHeight = height;

  if (newWidth > maxWidth) {
    newWidth = maxWidth;
    newHeight = Math.round(newWidth / ratio);
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = Math.round(newHeight * ratio);
  }

  return { width: Math.round(newWidth), height: Math.round(newHeight) };
}

// =============================================================================
// Focal Point Helpers
// =============================================================================

/**
 * Check if media has focal point
 */
export function hasFocalPoint(media: Media): boolean {
  return media.focalPoint !== null && media.focalPoint !== undefined;
}

/**
 * Get focal point or default center
 */
export function getFocalPoint(media: Media): FocalPoint {
  return media.focalPoint ?? { x: 0.5, y: 0.5 };
}

/**
 * Convert normalized focal point to pixel coordinates
 */
export function focalPointToPixels(media: Media): { x: number; y: number } | null {
  if (!hasDimensions(media)) return null;

  const focal = getFocalPoint(media);
  return {
    x: Math.round((media.width ?? 0) * focal.x),
    y: Math.round((media.height ?? 0) * focal.y),
  };
}

/**
 * Create focal point from pixel coordinates
 */
export function pixelsToFocalPoint(
  width: number,
  height: number,
  x: number,
  y: number,
): FocalPoint {
  return {
    x: Math.max(0, Math.min(1, x / width)),
    y: Math.max(0, Math.min(1, y / height)),
  };
}

// =============================================================================
// Size/Thumbnail Helpers
// =============================================================================

/**
 * Check if media has generated sizes
 */
export function hasSizes(media: Media): boolean {
  return media.sizes !== null && media.sizes !== undefined && media.sizes.length > 0;
}

/**
 * Get size by name
 */
export function getSizeByName(media: Media, name: string): ImageSize | undefined {
  return media.sizes?.find((size) => size.name === name);
}

/**
 * Get all size names
 */
export function getSizeNames(media: Media): string[] {
  return media.sizes?.map((size) => size.name) ?? [];
}

/**
 * Find best size for dimensions
 */
export function findBestSize(
  media: Media,
  targetWidth: number,
  targetHeight: number,
): ImageSize | null {
  if (!hasSizes(media)) return null;

  const sizes = media.sizes ?? [];
  let bestSize: ImageSize | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const size of sizes) {
    const widthDiff = Math.abs(size.width - targetWidth);
    const heightDiff = Math.abs(size.height - targetHeight);
    const score = widthDiff + heightDiff;

    if (score < bestScore) {
      bestScore = score;
      bestSize = size;
    }
  }

  return bestSize;
}

// =============================================================================
// File Size Helpers
// =============================================================================

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

/**
 * Check if file size is within limit
 */
export function isWithinSizeLimit(media: Media): boolean {
  if (!media.filesize) return true;

  const mediaType = getMediaType(media.mimeType);
  const limit =
    FILE_SIZE_LIMITS[mediaType.toUpperCase() as keyof typeof FILE_SIZE_LIMITS] ??
    FILE_SIZE_LIMITS.DEFAULT;

  return media.filesize <= limit;
}

/**
 * Get size limit for media type
 */
export function getSizeLimit(mimeType: string): number {
  const mediaType = getMediaType(mimeType);
  return (
    FILE_SIZE_LIMITS[mediaType.toUpperCase() as keyof typeof FILE_SIZE_LIMITS] ??
    FILE_SIZE_LIMITS.DEFAULT
  );
}

// =============================================================================
// Accessibility Helpers
// =============================================================================

/**
 * Check if media has alt text
 */
export function hasAltText(media: Media): boolean {
  return media.alt !== null && media.alt !== undefined && media.alt.length > 0;
}

/**
 * Check if alt text is meaningful (not just filename)
 */
export function hasMeaningfulAltText(media: Media): boolean {
  if (!hasAltText(media)) return false;

  const alt = media.alt ?? '';
  const filename = media.filename.toLowerCase();

  // Check if alt is just the filename or similar
  return alt.toLowerCase() !== filename && alt.length > 3;
}

// =============================================================================
// Ownership Helpers
// =============================================================================

/**
 * Check if media has uploader
 */
export function hasUploader(media: Media): boolean {
  return media.uploadedBy !== null && media.uploadedBy !== undefined;
}

/**
 * Check if media was uploaded by specific user
 */
export function isUploadedBy(media: Media, userId: string): boolean {
  return media.uploadedBy === userId;
}

// =============================================================================
// Media Creation
// =============================================================================

/**
 * Create media insert data
 */
export function createMediaInsert(
  filename: string,
  mimeType: string,
  url: string,
  options?: {
    id?: string;
    filesize?: number | null;
    alt?: string | null;
    width?: number | null;
    height?: number | null;
    focalPoint?: FocalPoint | null;
    sizes?: ImageSize[] | null;
    uploadedBy?: string | null;
  },
): MediaInsert {
  const now = new Date();

  return {
    id: options?.id ?? crypto.randomUUID(),
    schemaVersion: String(MEDIA_SCHEMA_VERSION),
    filename,
    mimeType,
    filesize: options?.filesize ?? null,
    url,
    alt: options?.alt ?? null,
    width: options?.width ?? null,
    height: options?.height ?? null,
    focalPoint: options?.focalPoint ?? null,
    sizes: options?.sizes ?? null,
    uploadedBy: options?.uploadedBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update media data
 */
export function updateMedia(updates: {
  alt?: string | null;
  focalPoint?: FocalPoint | null;
  sizes?: ImageSize[] | null;
}): Partial<Media> {
  const result: Partial<Media> = {
    updatedAt: new Date(),
  };

  if (updates.alt !== undefined) result.alt = updates.alt;
  if (updates.focalPoint !== undefined) result.focalPoint = updates.focalPoint;
  if (updates.sizes !== undefined) result.sizes = updates.sizes;

  return result;
}

// =============================================================================
// Extended Views with Computed Fields
// =============================================================================

/**
 * Media with computed fields for UI display
 */
export interface MediaWithComputed extends Media {
  _computed: {
    mediaType: MediaType;
    isImage: boolean;
    isVideo: boolean;
    isAudio: boolean;
    isDocument: boolean;
    hasDimensions: boolean;
    aspectRatio: number | null;
    isLandscape: boolean;
    isPortrait: boolean;
    isSquare: boolean;
    hasFocalPoint: boolean;
    hasSizes: boolean;
    hasAltText: boolean;
    hasMeaningfulAltText: boolean;
    hasUploader: boolean;
    isWithinSizeLimit: boolean;
    formattedFileSize: string;
    extension: string;
  };
}

/**
 * Convert media to format with computed fields
 */
export function mediaToHuman(media: Media): MediaWithComputed {
  return {
    ...media,
    _computed: {
      mediaType: getMediaType(media.mimeType),
      isImage: isImage(media),
      isVideo: isVideo(media),
      isAudio: isAudio(media),
      isDocument: isDocument(media),
      hasDimensions: hasDimensions(media),
      aspectRatio: getAspectRatio(media),
      isLandscape: isLandscape(media),
      isPortrait: isPortrait(media),
      isSquare: isSquare(media),
      hasFocalPoint: hasFocalPoint(media),
      hasSizes: hasSizes(media),
      hasAltText: hasAltText(media),
      hasMeaningfulAltText: hasMeaningfulAltText(media),
      hasUploader: hasUploader(media),
      isWithinSizeLimit: isWithinSizeLimit(media),
      formattedFileSize: formatFileSize(media.filesize ?? 0),
      extension: getFileExtension(media.filename),
    },
  };
}

/**
 * Media with metadata for agent/API consumption
 */
export interface MediaAgent extends Media {
  metadata: {
    type: MediaType;
    extension: string;
    hasAlt: boolean;
    dimensionsPresent: boolean;
    aspectRatio: number | null;
    orientation: 'landscape' | 'portrait' | 'square' | null;
    sizesAvailable: number;
    withinSizeLimit: boolean;
  };
}

/**
 * Convert media to agent-compatible format
 */
export function mediaToAgent(media: Media): MediaAgent {
  const ratio = getAspectRatio(media);
  let orientation: 'landscape' | 'portrait' | 'square' | null = null;

  if (ratio !== null) {
    if (Math.abs(ratio - 1) < 0.01) orientation = 'square';
    else if (ratio > 1) orientation = 'landscape';
    else orientation = 'portrait';
  }

  return {
    ...media,
    metadata: {
      type: getMediaType(media.mimeType),
      extension: getFileExtension(media.filename),
      hasAlt: hasAltText(media),
      dimensionsPresent: hasDimensions(media),
      aspectRatio: ratio,
      orientation,
      sizesAvailable: media.sizes?.length ?? 0,
      withinSizeLimit: isWithinSizeLimit(media),
    },
  };
}

/**
 * Zod schema for media with computed fields
 */
export const MediaWithComputedSchema = MediaSchema.and(
  z.object({
    _computed: z.object({
      mediaType: z.enum(MEDIA_TYPES),
      isImage: z.boolean(),
      isVideo: z.boolean(),
      isAudio: z.boolean(),
      isDocument: z.boolean(),
      hasDimensions: z.boolean(),
      aspectRatio: z.number().nullable(),
      isLandscape: z.boolean(),
      isPortrait: z.boolean(),
      isSquare: z.boolean(),
      hasFocalPoint: z.boolean(),
      hasSizes: z.boolean(),
      hasAltText: z.boolean(),
      hasMeaningfulAltText: z.boolean(),
      hasUploader: z.boolean(),
      isWithinSizeLimit: z.boolean(),
      formattedFileSize: z.string(),
      extension: z.string(),
    }),
  }),
);

/**
 * Zod schema for media with agent metadata
 */
export const MediaAgentSchema = MediaSchema.and(
  z.object({
    metadata: z.object({
      type: z.enum(MEDIA_TYPES),
      extension: z.string(),
      hasAlt: z.boolean(),
      dimensionsPresent: z.boolean(),
      aspectRatio: z.number().nullable(),
      orientation: z.enum(['landscape', 'portrait', 'square']).nullable(),
      sizesAvailable: z.number().int(),
      withinSizeLimit: z.boolean(),
    }),
  }),
);

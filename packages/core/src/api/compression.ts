/**
 * API Response Compression Middleware
 *
 * Implements gzip and brotli compression for API responses
 */

import { logger } from '../observability/logger.js';

interface CompressionOptions {
  threshold?: number; // Minimum response size to compress (bytes)
  level?: number; // Compression level (1-9 for gzip, 0-11 for brotli)
  preferBrotli?: boolean; // Prefer brotli over gzip when available
  excludeTypes?: string[]; // Content types to exclude from compression
}

const DEFAULT_OPTIONS: CompressionOptions = {
  threshold: 1024, // 1KB minimum
  level: 6, // Balanced compression
  preferBrotli: true,
  excludeTypes: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'video/mp4',
    'application/zip',
    'application/gzip',
    'application/pdf',
  ],
};

/**
 * Check if response should be compressed
 */
function shouldCompress(response: Response, options: CompressionOptions): boolean {
  const contentType = response.headers.get('content-type') || '';
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

  // Check if already compressed
  if (response.headers.get('content-encoding')) {
    return false;
  }

  // Check content type exclusions
  if (options.excludeTypes?.some((type) => contentType.includes(type))) {
    return false;
  }

  // Check size threshold
  if (contentLength > 0 && contentLength < (options.threshold || 0)) {
    return false;
  }

  return true;
}

/**
 * Get best compression encoding from Accept-Encoding header
 */
function getBestEncoding(request: Request, preferBrotli: boolean): string | null {
  const acceptEncoding = request.headers.get('accept-encoding') || '';

  const supportsBrotli = acceptEncoding.includes('br');
  const supportsGzip = acceptEncoding.includes('gzip');

  if (preferBrotli && supportsBrotli) {
    return 'br';
  }

  if (supportsGzip) {
    return 'gzip';
  }

  if (supportsBrotli) {
    return 'br';
  }

  return null;
}

/**
 * Compress response body
 */
async function compressBody(
  body: string | Uint8Array,
  encoding: string,
  _level: number,
): Promise<Uint8Array> {
  const textEncoder = new TextEncoder();
  const data = typeof body === 'string' ? textEncoder.encode(body) : body;

  if (encoding === 'gzip') {
    // Use CompressionStream API (available in modern environments)
    const stream = new Response(data as BodyInit).body?.pipeThrough(new CompressionStream('gzip'));
    const compressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(compressed);
  }

  if (encoding === 'br') {
    // Brotli compression
    // Note: CompressionStream('deflate-raw') is available, but not 'br' in all environments
    // Fallback to gzip if brotli not available
    try {
      const stream = new Response(data as BodyInit).body?.pipeThrough(
        new CompressionStream('deflate'),
      );
      const compressed = await new Response(stream).arrayBuffer();
      return new Uint8Array(compressed);
    } catch {
      // Fallback to gzip
      const stream = new Response(data as BodyInit).body?.pipeThrough(
        new CompressionStream('gzip'),
      );
      const compressed = await new Response(stream).arrayBuffer();
      return new Uint8Array(compressed);
    }
  }

  return data;
}

/**
 * Compress API response
 */
export async function compressResponse(
  request: Request,
  response: Response,
  options: CompressionOptions = {},
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Check if should compress
  if (!shouldCompress(response, opts)) {
    return response;
  }

  // Get best encoding
  const encoding = getBestEncoding(request, opts.preferBrotli ?? true);
  if (!encoding) {
    return response;
  }

  try {
    // Get response body
    const body = await response.text();

    // Compress body
    const compressed = await compressBody(body, encoding, opts.level || 6);

    // Create new response with compressed body
    const newResponse = new Response(compressed as BodyInit, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    // Set compression headers
    newResponse.headers.set('content-encoding', encoding);
    newResponse.headers.set('content-length', compressed.length.toString());
    newResponse.headers.delete('content-length'); // Let runtime set it
    newResponse.headers.set('vary', 'Accept-Encoding');

    return newResponse;
  } catch (error) {
    logger.error('Compression error', error instanceof Error ? error : new Error(String(error)));
    return response;
  }
}

/**
 * Create compression middleware
 */
export function createCompressionMiddleware(options: CompressionOptions = {}) {
  return async (request: Request, next: () => Promise<Response>) => {
    const response = await next();
    return compressResponse(request, response, options);
  };
}

/**
 * Calculate compression ratio
 */
export function getCompressionRatio(originalSize: number, compressedSize: number): number {
  return ((originalSize - compressedSize) / originalSize) * 100;
}

/**
 * Get compression stats
 */
export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  encoding: string;
  savings: number;
}

export function getCompressionStats(
  originalBody: string | Uint8Array,
  compressedBody: Uint8Array,
  encoding: string,
): CompressionStats {
  const originalSize =
    typeof originalBody === 'string' ? new Blob([originalBody]).size : originalBody.length;

  const compressedSize = compressedBody.length;
  const compressionRatio = getCompressionRatio(originalSize, compressedSize);
  const savings = originalSize - compressedSize;

  return {
    originalSize,
    compressedSize,
    compressionRatio,
    encoding,
    savings,
  };
}

/**
 * Preset compression configurations
 */
export const COMPRESSION_PRESETS = {
  // Fast compression, lower ratio
  fast: {
    threshold: 512,
    level: 3,
    preferBrotli: false,
  },

  // Balanced compression
  balanced: {
    threshold: 1024,
    level: 6,
    preferBrotli: true,
  },

  // Maximum compression, slower
  max: {
    threshold: 512,
    level: 9,
    preferBrotli: true,
  },

  // For static assets
  static: {
    threshold: 1024,
    level: 9,
    preferBrotli: true,
  },

  // For API responses
  api: {
    threshold: 512,
    level: 6,
    preferBrotli: true,
    excludeTypes: [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'video/mp4',
      'application/zip',
      'application/gzip',
      'application/pdf',
    ],
  },
} as const;

/**
 * Compress JSON response
 */
export async function compressJSON(
  data: unknown,
  encoding: 'gzip' | 'br' = 'gzip',
  level: number = 6,
): Promise<Uint8Array> {
  const json = JSON.stringify(data);
  return compressBody(json, encoding, level);
}

/**
 * Decompress response
 */
export async function decompressBody(body: Uint8Array, encoding: string): Promise<Uint8Array> {
  if (encoding === 'gzip') {
    const stream = new Response(body as BodyInit).body?.pipeThrough(
      new DecompressionStream('gzip'),
    );
    const decompressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(decompressed);
  }

  if (encoding === 'br' || encoding === 'deflate') {
    const stream = new Response(body as BodyInit).body?.pipeThrough(
      new DecompressionStream('deflate'),
    );
    const decompressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(decompressed);
  }

  return body;
}

/**
 * Check if compression is supported
 */
export function isCompressionSupported(request: Request): {
  gzip: boolean;
  brotli: boolean;
} {
  const acceptEncoding = request.headers.get('accept-encoding') || '';

  return {
    gzip: acceptEncoding.includes('gzip'),
    brotli: acceptEncoding.includes('br'),
  };
}

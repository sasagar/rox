/**
 * Image Processor Service
 *
 * Provides image processing capabilities including:
 * - WebP conversion for optimized file sizes
 * - Thumbnail generation for timeline display
 * - Blurhash generation for progressive loading
 *
 * @module services/ImageProcessor
 */

import sharp from "sharp";
import { encode as blurhashEncode } from "blurhash";
import { logger } from "../lib/logger.js";

/**
 * Processed image result
 */
export interface ProcessedImage {
  /** WebP converted image buffer */
  webp: Buffer;
  /** WebP MIME type */
  webpType: string;
  /** Thumbnail buffer (WebP format) */
  thumbnail: Buffer;
  /** Thumbnail MIME type */
  thumbnailType: string;
  /** Original image width */
  width: number;
  /** Original image height */
  height: number;
  /** Blurhash for progressive loading */
  blurhash: string | null;
}

/**
 * Image processing options
 */
export interface ProcessOptions {
  /** WebP quality (1-100, default: 80) */
  webpQuality?: number;
  /** Maximum width for WebP conversion (preserves aspect ratio) */
  maxWidth?: number;
  /** Maximum height for WebP conversion (preserves aspect ratio) */
  maxHeight?: number;
  /** Thumbnail width (default: 800) */
  thumbnailWidth?: number;
  /** Thumbnail height (default: 800) */
  thumbnailHeight?: number;
  /** Generate blurhash (default: true) */
  generateBlurhash?: boolean;
}

/**
 * Default processing options
 */
const DEFAULT_OPTIONS: Required<ProcessOptions> = {
  webpQuality: 80,
  maxWidth: 2048,
  maxHeight: 2048,
  thumbnailWidth: 800,
  thumbnailHeight: 800,
  generateBlurhash: true,
};

/**
 * Supported image MIME types
 */
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heif",
  "image/heic",
  "image/tiff",
]);

/**
 * Image Processor
 *
 * Uses sharp library for high-performance image processing.
 *
 * @example
 * ```typescript
 * const processor = new ImageProcessor();
 * const result = await processor.process(buffer, 'image/jpeg');
 * // result.webp - WebP converted image
 * // result.thumbnail - Thumbnail for timeline
 * // result.blurhash - Blurhash string
 * ```
 */
export class ImageProcessor {
  /**
   * Check if a MIME type is a processable image
   *
   * @param mimeType - MIME type to check
   * @returns true if the type can be processed
   */
  isImage(mimeType: string): boolean {
    return SUPPORTED_IMAGE_TYPES.has(mimeType.toLowerCase());
  }

  /**
   * Process an image
   *
   * Converts to WebP, generates thumbnail, and calculates blurhash.
   *
   * @param buffer - Original image buffer
   * @param mimeType - Original MIME type
   * @param options - Processing options
   * @returns Processed image result
   */
  async process(
    buffer: Buffer,
    _mimeType: string,
    options: ProcessOptions = {},
  ): Promise<ProcessedImage> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Get original image metadata
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // Process WebP conversion and thumbnail in parallel
    const [webpResult, thumbnailResult, blurhash] = await Promise.all([
      this.convertToWebP(buffer, opts),
      this.generateThumbnail(buffer, opts),
      opts.generateBlurhash ? this.generateBlurhash(buffer) : null,
    ]);

    return {
      webp: webpResult,
      webpType: "image/webp",
      thumbnail: thumbnailResult,
      thumbnailType: "image/webp",
      width,
      height,
      blurhash,
    };
  }

  /**
   * Convert image to WebP format
   *
   * @param buffer - Original image buffer
   * @param options - Processing options
   * @returns WebP buffer
   */
  private async convertToWebP(buffer: Buffer, options: Required<ProcessOptions>): Promise<Buffer> {
    return await sharp(buffer)
      .resize(options.maxWidth, options.maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: options.webpQuality })
      .toBuffer();
  }

  /**
   * Generate thumbnail
   *
   * Creates a smaller WebP image for timeline display.
   *
   * @param buffer - Original image buffer
   * @param options - Processing options
   * @returns Thumbnail buffer
   */
  private async generateThumbnail(
    buffer: Buffer,
    options: Required<ProcessOptions>,
  ): Promise<Buffer> {
    return await sharp(buffer)
      .resize(options.thumbnailWidth, options.thumbnailHeight, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 70 })
      .toBuffer();
  }

  /**
   * Generate blurhash for progressive image loading
   *
   * @param buffer - Original image buffer
   * @returns Blurhash string or null if generation fails
   */
  private async generateBlurhash(buffer: Buffer): Promise<string | null> {
    try {
      // Resize to small size for blurhash calculation
      const { data, info } = await sharp(buffer)
        .resize(32, 32, { fit: "inside" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      return blurhashEncode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);
    } catch (error) {
      logger.debug({ err: error }, "Failed to generate blurhash");
      return null;
    }
  }

  /**
   * Get image metadata without processing
   *
   * @param buffer - Image buffer
   * @returns Image metadata (width, height, format)
   */
  async getMetadata(
    buffer: Buffer,
  ): Promise<{ width: number; height: number; format: string | undefined }> {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format,
    };
  }
}

/**
 * Singleton instance for shared use
 */
let imageProcessorInstance: ImageProcessor | null = null;

/**
 * Get singleton ImageProcessor instance
 */
export function getImageProcessor(): ImageProcessor {
  if (!imageProcessorInstance) {
    imageProcessorInstance = new ImageProcessor();
  }
  return imageProcessorInstance;
}

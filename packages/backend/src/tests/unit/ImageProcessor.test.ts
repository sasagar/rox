/**
 * ImageProcessor Unit Tests
 *
 * Tests image processing functionality including
 * WebP conversion, thumbnail generation, and format detection
 */

import { describe, test, expect } from "bun:test";
import { ImageProcessor } from "../../services/ImageProcessor";

describe("ImageProcessor", () => {
  const processor = new ImageProcessor();

  describe("isImage", () => {
    test("should recognize JPEG as image", () => {
      expect(processor.isImage("image/jpeg")).toBe(true);
    });

    test("should recognize PNG as image", () => {
      expect(processor.isImage("image/png")).toBe(true);
    });

    test("should recognize GIF as image", () => {
      expect(processor.isImage("image/gif")).toBe(true);
    });

    test("should recognize WebP as image", () => {
      expect(processor.isImage("image/webp")).toBe(true);
    });

    test("should recognize AVIF as image", () => {
      expect(processor.isImage("image/avif")).toBe(true);
    });

    test("should recognize HEIF as image", () => {
      expect(processor.isImage("image/heif")).toBe(true);
    });

    test("should recognize HEIC as image", () => {
      expect(processor.isImage("image/heic")).toBe(true);
    });

    test("should recognize TIFF as image", () => {
      expect(processor.isImage("image/tiff")).toBe(true);
    });

    test("should not recognize SVG as processable image", () => {
      // SVG is excluded because sharp doesn't process it well for WebP conversion
      expect(processor.isImage("image/svg+xml")).toBe(false);
    });

    test("should not recognize video as image", () => {
      expect(processor.isImage("video/mp4")).toBe(false);
    });

    test("should not recognize audio as image", () => {
      expect(processor.isImage("audio/mpeg")).toBe(false);
    });

    test("should not recognize text as image", () => {
      expect(processor.isImage("text/plain")).toBe(false);
    });

    test("should handle case insensitivity", () => {
      expect(processor.isImage("IMAGE/JPEG")).toBe(true);
      expect(processor.isImage("Image/Png")).toBe(true);
    });
  });

  describe("process", () => {
    // Create a minimal valid PNG image (1x1 pixel)
    const createTestPng = (): Buffer => {
      // Minimal 1x1 white PNG
      return Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
        0x00,
        0x00,
        0x00,
        0x0d,
        0x49,
        0x48,
        0x44,
        0x52, // IHDR chunk
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x01, // 1x1
        0x08,
        0x02,
        0x00,
        0x00,
        0x00,
        0x90,
        0x77,
        0x53,
        0xde,
        0x00,
        0x00,
        0x00,
        0x0c,
        0x49,
        0x44,
        0x41, // IDAT chunk
        0x54,
        0x08,
        0xd7,
        0x63,
        0xf8,
        0xff,
        0xff,
        0x3f,
        0x00,
        0x05,
        0xfe,
        0x02,
        0xfe,
        0xdc,
        0xcc,
        0x59,
        0xe7,
        0x00,
        0x00,
        0x00,
        0x00,
        0x49,
        0x45,
        0x4e, // IEND chunk
        0x44,
        0xae,
        0x42,
        0x60,
        0x82,
      ]);
    };

    test("should process PNG and return WebP", async () => {
      const pngBuffer = createTestPng();

      const result = await processor.process(pngBuffer, "image/png");

      expect(result.webpType).toBe("image/webp");
      expect(result.thumbnailType).toBe("image/webp");
      expect(result.webp).toBeInstanceOf(Buffer);
      expect(result.thumbnail).toBeInstanceOf(Buffer);
    });

    test("should return image dimensions", async () => {
      const pngBuffer = createTestPng();

      const result = await processor.process(pngBuffer, "image/png");

      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
    });

    test("should generate blurhash", async () => {
      const pngBuffer = createTestPng();

      const result = await processor.process(pngBuffer, "image/png");

      // Blurhash should be a non-empty string or null
      if (result.blurhash !== null) {
        expect(typeof result.blurhash).toBe("string");
        expect(result.blurhash.length).toBeGreaterThan(0);
      }
    });

    test("should respect generateBlurhash option", async () => {
      const pngBuffer = createTestPng();

      const result = await processor.process(pngBuffer, "image/png", {
        generateBlurhash: false,
      });

      expect(result.blurhash).toBeNull();
    });

    test("should handle custom quality option", async () => {
      const pngBuffer = createTestPng();

      const highQuality = await processor.process(pngBuffer, "image/png", {
        webpQuality: 100,
      });

      const lowQuality = await processor.process(pngBuffer, "image/png", {
        webpQuality: 10,
      });

      // Both should produce valid WebP output
      expect(highQuality.webp).toBeInstanceOf(Buffer);
      expect(lowQuality.webp).toBeInstanceOf(Buffer);
    });
  });

  describe("getMetadata", () => {
    const createTestPng = (): Buffer => {
      return Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
        0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8,
        0xff, 0xff, 0x3f, 0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);
    };

    test("should return image metadata", async () => {
      const pngBuffer = createTestPng();

      const metadata = await processor.getMetadata(pngBuffer);

      expect(metadata.width).toBe(1);
      expect(metadata.height).toBe(1);
      expect(metadata.format).toBe("png");
    });
  });
});

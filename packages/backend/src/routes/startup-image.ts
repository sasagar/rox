/**
 * iOS PWA Startup Image Routes
 *
 * Generates dynamic startup images (splash screens) for iOS PWA.
 * These images are displayed during PWA launch before HTML loads.
 *
 * @module routes/startup-image
 */

import { Hono } from "hono";
import type { Context } from "hono";
import sharp from "sharp";
import { InstanceSettingsService } from "../services/InstanceSettingsService.js";

const app = new Hono();

/**
 * iOS Device Specifications for Startup Images
 *
 * Each device requires specific dimensions based on:
 * - CSS viewport width × device pixel ratio
 * - CSS viewport height × device pixel ratio
 *
 * References:
 * - https://www.ios-resolution.com/
 * - https://developer.apple.com/design/human-interface-guidelines/layout
 */
interface DeviceSpec {
  name: string;
  width: number;
  height: number;
  pixelRatio: number;
  // Actual image dimensions (viewport × pixelRatio)
  imageWidth: number;
  imageHeight: number;
}

const IOS_DEVICES: DeviceSpec[] = [
  // iPhone 16 Pro Max (2024)
  { name: "iPhone 16 Pro Max", width: 440, height: 956, pixelRatio: 3, imageWidth: 1320, imageHeight: 2868 },
  // iPhone 16 Pro (2024)
  { name: "iPhone 16 Pro", width: 402, height: 874, pixelRatio: 3, imageWidth: 1206, imageHeight: 2622 },
  // iPhone 16 Plus (2024)
  { name: "iPhone 16 Plus", width: 430, height: 932, pixelRatio: 3, imageWidth: 1290, imageHeight: 2796 },
  // iPhone 16 (2024)
  { name: "iPhone 16", width: 393, height: 852, pixelRatio: 3, imageWidth: 1179, imageHeight: 2556 },
  // iPhone 15 Pro Max (2023)
  { name: "iPhone 15 Pro Max", width: 430, height: 932, pixelRatio: 3, imageWidth: 1290, imageHeight: 2796 },
  // iPhone 15 Pro (2023)
  { name: "iPhone 15 Pro", width: 393, height: 852, pixelRatio: 3, imageWidth: 1179, imageHeight: 2556 },
  // iPhone 15 Plus (2023)
  { name: "iPhone 15 Plus", width: 430, height: 932, pixelRatio: 3, imageWidth: 1290, imageHeight: 2796 },
  // iPhone 15 (2023)
  { name: "iPhone 15", width: 393, height: 852, pixelRatio: 3, imageWidth: 1179, imageHeight: 2556 },
  // iPhone 14 Pro Max (2022)
  { name: "iPhone 14 Pro Max", width: 430, height: 932, pixelRatio: 3, imageWidth: 1290, imageHeight: 2796 },
  // iPhone 14 Pro (2022)
  { name: "iPhone 14 Pro", width: 393, height: 852, pixelRatio: 3, imageWidth: 1179, imageHeight: 2556 },
  // iPhone 14 Plus (2022)
  { name: "iPhone 14 Plus", width: 428, height: 926, pixelRatio: 3, imageWidth: 1284, imageHeight: 2778 },
  // iPhone 14 (2022)
  { name: "iPhone 14", width: 390, height: 844, pixelRatio: 3, imageWidth: 1170, imageHeight: 2532 },
  // iPhone 13 Pro Max / 12 Pro Max
  { name: "iPhone 13/12 Pro Max", width: 428, height: 926, pixelRatio: 3, imageWidth: 1284, imageHeight: 2778 },
  // iPhone 13 Pro / 13 / 12 Pro / 12
  { name: "iPhone 13/12 Pro/13/12", width: 390, height: 844, pixelRatio: 3, imageWidth: 1170, imageHeight: 2532 },
  // iPhone 13 mini / 12 mini
  { name: "iPhone 13/12 mini", width: 375, height: 812, pixelRatio: 3, imageWidth: 1125, imageHeight: 2436 },
  // iPhone 11 Pro Max / XS Max
  { name: "iPhone 11 Pro Max/XS Max", width: 414, height: 896, pixelRatio: 3, imageWidth: 1242, imageHeight: 2688 },
  // iPhone 11 / XR
  { name: "iPhone 11/XR", width: 414, height: 896, pixelRatio: 2, imageWidth: 828, imageHeight: 1792 },
  // iPhone 11 Pro / X / XS
  { name: "iPhone 11 Pro/X/XS", width: 375, height: 812, pixelRatio: 3, imageWidth: 1125, imageHeight: 2436 },
  // iPhone SE (3rd/2nd gen) / 8 / 7 / 6s
  { name: "iPhone SE/8/7/6s", width: 375, height: 667, pixelRatio: 2, imageWidth: 750, imageHeight: 1334 },
  // iPhone 8 Plus / 7 Plus / 6s Plus
  { name: "iPhone 8/7/6s Plus", width: 414, height: 736, pixelRatio: 3, imageWidth: 1242, imageHeight: 2208 },
  // iPhone SE (1st gen) / 5s / 5c / 5
  { name: "iPhone SE 1st/5s", width: 320, height: 568, pixelRatio: 2, imageWidth: 640, imageHeight: 1136 },

  // iPads
  // iPad Pro 13" (M4, 7th gen)
  { name: "iPad Pro 13\"", width: 1032, height: 1376, pixelRatio: 2, imageWidth: 2064, imageHeight: 2752 },
  // iPad Pro 11" (M4, 7th gen)
  { name: "iPad Pro 11\"", width: 834, height: 1210, pixelRatio: 2, imageWidth: 1668, imageHeight: 2420 },
  // iPad Air 13" (M2, 6th gen)
  { name: "iPad Air 13\"", width: 1024, height: 1366, pixelRatio: 2, imageWidth: 2048, imageHeight: 2732 },
  // iPad Air 11" (M2, 6th gen) / iPad 10th gen
  { name: "iPad Air 11\"/iPad 10th", width: 820, height: 1180, pixelRatio: 2, imageWidth: 1640, imageHeight: 2360 },
  // iPad mini 7th gen
  { name: "iPad mini 7th", width: 744, height: 1133, pixelRatio: 2, imageWidth: 1488, imageHeight: 2266 },
  // iPad mini 6th gen
  { name: "iPad mini 6th", width: 744, height: 1133, pixelRatio: 2, imageWidth: 1488, imageHeight: 2266 },
  // iPad Pro 12.9" (older)
  { name: "iPad Pro 12.9\" older", width: 1024, height: 1366, pixelRatio: 2, imageWidth: 2048, imageHeight: 2732 },
  // iPad Pro 11" (older)
  { name: "iPad Pro 11\" older", width: 834, height: 1194, pixelRatio: 2, imageWidth: 1668, imageHeight: 2388 },
  // iPad Pro 10.5" / iPad Air 3rd
  { name: "iPad Pro 10.5\"/Air 3rd", width: 834, height: 1112, pixelRatio: 2, imageWidth: 1668, imageHeight: 2224 },
  // iPad 9th/8th/7th gen
  { name: "iPad 9th/8th/7th", width: 810, height: 1080, pixelRatio: 2, imageWidth: 1620, imageHeight: 2160 },
  // iPad 6th/5th gen / iPad Air 2 / iPad Pro 9.7"
  { name: "iPad 6th/5th/Air 2", width: 768, height: 1024, pixelRatio: 2, imageWidth: 1536, imageHeight: 2048 },
  // iPad mini 5th/4th gen
  { name: "iPad mini 5th/4th", width: 768, height: 1024, pixelRatio: 2, imageWidth: 1536, imageHeight: 2048 },
];

/**
 * Parse hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: Number.parseInt(result[1]!, 16),
      g: Number.parseInt(result[2]!, 16),
      b: Number.parseInt(result[3]!, 16),
    };
  }
  // Default to white if parsing fails
  return { r: 255, g: 255, b: 255 };
}

/**
 * Generate Startup Image
 *
 * GET /api/startup-image/:width/:height
 *
 * Generates a startup image with the specified dimensions.
 * The image contains:
 * - Background color from theme
 * - Centered instance icon
 *
 * Query params:
 * - orientation: 'portrait' | 'landscape' (default: portrait)
 */
app.get("/:width/:height", async (c: Context) => {
  const widthParam = c.req.param("width");
  const heightParam = c.req.param("height");
  const orientation = c.req.query("orientation") || "portrait";

  const width = Number.parseInt(widthParam, 10);
  const height = Number.parseInt(heightParam, 10);

  // Validate dimensions
  if (Number.isNaN(width) || Number.isNaN(height) || width < 1 || height < 1) {
    return c.json({ error: "Invalid dimensions" }, 400);
  }

  // Limit max dimensions to prevent abuse
  if (width > 3000 || height > 3000) {
    return c.json({ error: "Dimensions too large" }, 400);
  }

  // Swap dimensions for landscape
  const finalWidth = orientation === "landscape" ? height : width;
  const finalHeight = orientation === "landscape" ? width : height;

  try {
    const instanceSettingsRepository = c.get("instanceSettingsRepository");
    const instanceSettingsService = new InstanceSettingsService(instanceSettingsRepository);

    const [metadata, theme] = await Promise.all([
      instanceSettingsService.getInstanceMetadata(),
      instanceSettingsService.getThemeSettings(),
    ]);

    // Get background color from theme or use white
    const bgColor = theme.primaryColor || "#4f46e5";
    const rgb = hexToRgb(bgColor);

    // Calculate icon size (roughly 20% of the smaller dimension)
    const iconSize = Math.floor(Math.min(finalWidth, finalHeight) * 0.2);

    // Create base image with background color
    let image = sharp({
      create: {
        width: finalWidth,
        height: finalHeight,
        channels: 3,
        background: rgb,
      },
    });

    // Try to fetch and overlay the icon
    const iconUrl = metadata.pwaIcon512Url || metadata.iconUrl;
    if (iconUrl) {
      try {
        // Fetch icon image
        let iconBuffer: Buffer;

        if (iconUrl.startsWith("/")) {
          // Local file - construct full URL
          const baseUrl = process.env.URL || "http://localhost:3000";
          const response = await fetch(`${baseUrl}${iconUrl}`);
          if (response.ok) {
            iconBuffer = Buffer.from(await response.arrayBuffer());
          } else {
            throw new Error("Failed to fetch local icon");
          }
        } else {
          // External URL
          const response = await fetch(iconUrl);
          if (response.ok) {
            iconBuffer = Buffer.from(await response.arrayBuffer());
          } else {
            throw new Error("Failed to fetch external icon");
          }
        }

        // Resize icon
        const resizedIcon = await sharp(iconBuffer)
          .resize(iconSize, iconSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();

        // Calculate position to center the icon
        const iconX = Math.floor((finalWidth - iconSize) / 2);
        const iconY = Math.floor((finalHeight - iconSize) / 2);

        // Composite icon onto background
        image = sharp({
          create: {
            width: finalWidth,
            height: finalHeight,
            channels: 4,
            background: { ...rgb, alpha: 1 },
          },
        }).composite([
          {
            input: resizedIcon,
            left: iconX,
            top: iconY,
          },
        ]);
      } catch {
        // If icon fetch fails, just use background color
        console.warn("Failed to load icon for startup image, using solid color");
      }
    }

    // Generate PNG
    const pngBuffer = await image.png().toBuffer();

    return new Response(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error("Error generating startup image:", error);
    return c.json({ error: "Failed to generate image" }, 500);
  }
});

/**
 * Get Startup Image Specifications
 *
 * GET /api/startup-image/specs
 *
 * Returns the list of all supported iOS device specifications
 * and their required startup image dimensions.
 */
app.get("/specs", (c: Context) => {
  return c.json({
    devices: IOS_DEVICES.map((device) => ({
      name: device.name,
      viewport: { width: device.width, height: device.height },
      pixelRatio: device.pixelRatio,
      imageSize: { width: device.imageWidth, height: device.imageHeight },
      // Media query for this device
      mediaQuery: `(device-width: ${device.width}px) and (device-height: ${device.height}px) and (-webkit-device-pixel-ratio: ${device.pixelRatio})`,
    })),
  });
});

export default app;

export { IOS_DEVICES };

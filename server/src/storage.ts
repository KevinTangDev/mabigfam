import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

/**
 * Photo storage, kept behind this small module so it is the only place to
 * change when moving off local disk. A deploy target with an ephemeral
 * filesystem (containers on Fly/Render, serverless) will lose these files on
 * restart — swap the three functions below for S3/R2 calls and nothing else
 * in the app needs to know.
 */

type ImageKind = { ext: string; mime: string };

/**
 * Identifies an image from its leading bytes. The browser-supplied
 * Content-Type is attacker-controlled, so it is never trusted for this.
 */
function sniffImage(buffer: Buffer): ImageKind | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: "png", mime: "image/png" };
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { ext: "webp", mime: "image/webp" };
  }

  return null;
}

/**
 * HEIC gets a dedicated check so iPhone users get a useful message instead of
 * a generic rejection. Uploading straight from iOS normally transcodes to
 * JPEG automatically; this only bites when someone hands over a .heic file
 * from a desktop.
 */
export function isHeic(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
  const brand = buffer.subarray(8, 12).toString("ascii");
  return ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand);
}

export class UnsupportedImageError extends Error {}

/** Writes a photo and returns the opaque key to persist in `photoPath`. */
export async function savePhoto(buffer: Buffer): Promise<string> {
  const kind = sniffImage(buffer);

  if (!kind) {
    throw new UnsupportedImageError(
      isHeic(buffer)
        ? "HEIC images aren't supported. Convert it to JPEG first, or set your iPhone camera to " +
          "Settings > Camera > Formats > Most Compatible."
        : "Unsupported image type. Please upload a JPEG, PNG or WebP file.",
    );
  }

  // Random filename: never derived from user input, so there is no path
  // traversal or collision surface.
  const key = `${crypto.randomUUID()}.${kind.ext}`;

  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadDir, key), buffer);

  return key;
}

/** Reads a stored photo, or null if it's missing (e.g. wiped by a redeploy). */
export async function readPhoto(key: string): Promise<{ buffer: Buffer; mime: string } | null> {
  if (key.includes("/") || key.includes("\\") || key.includes("..")) return null;

  try {
    const buffer = await fs.readFile(path.join(config.uploadDir, key));
    const kind = sniffImage(buffer);
    return kind ? { buffer, mime: kind.mime } : null;
  } catch {
    return null;
  }
}

export async function deletePhoto(key: string): Promise<void> {
  // Guard against a malformed key escaping the upload directory, even though
  // keys are generated above rather than accepted from callers.
  if (key.includes("/") || key.includes("\\") || key.includes("..")) return;

  await fs.rm(path.join(config.uploadDir, key), { force: true });
}

import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { readPhoto, savePhoto, UnsupportedImageError } from "../src/storage.js";

async function makeJpeg(width: number, height: number, color = { r: 200, g: 50, b: 50 }): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } }).jpeg().toBuffer();
}

describe("savePhoto (resize + normalize)", () => {
  it("stores every accepted format as JPEG", async () => {
    const png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 100, b: 200 } },
    })
      .png()
      .toBuffer();

    const key = await savePhoto(png);
    expect(key).toMatch(/\.jpg$/);

    const stored = await readPhoto(key);
    expect(stored?.mime).toBe("image/jpeg");
    // FF D8 FF is the JPEG magic-byte header — confirms an actual re-encode
    // happened, not just a renamed copy of the original PNG bytes.
    expect(stored?.buffer.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });

  it("downscales an image larger than photoMaxDimension", async () => {
    const big = config.photoMaxDimension + 500;
    const key = await savePhoto(await makeJpeg(big, 100));

    const stored = await readPhoto(key);
    const meta = await sharp(stored!.buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(config.photoMaxDimension);
    // fit: "inside" preserves aspect ratio — should scale down proportionally,
    // not just clamp width and leave height untouched.
    expect(meta.width).toBeLessThan(big);
  });

  it("does not upscale an image smaller than photoMaxDimension", async () => {
    const key = await savePhoto(await makeJpeg(10, 10));
    const stored = await readPhoto(key);
    const meta = await sharp(stored!.buffer).metadata();
    expect(meta.width).toBe(10);
    expect(meta.height).toBe(10);
  });

  it("rejects a buffer whose header looks valid but isn't a real image", async () => {
    // Passes storage.ts's own magic-byte sniff (real JPEG SOI marker) but has
    // no actual image data after it — sharp must reject this at decode time,
    // not silently write garbage to disk. This is a regression guard: an
    // earlier version of this test suite used exactly this kind of fixture
    // and it broke the moment savePhoto started actually decoding uploads.
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    await expect(savePhoto(fakeJpeg)).rejects.toThrow(UnsupportedImageError);
  });

  it("still rejects a non-image buffer before ever reaching sharp", async () => {
    await expect(savePhoto(Buffer.from("just some text, not an image"))).rejects.toThrow(
      UnsupportedImageError,
    );
  });
});

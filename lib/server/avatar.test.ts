import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { maxAvatarUploadBytes, normalizeAvatarImage } from "@/lib/server/avatar";

describe("normalizeAvatarImage", () => {
  it("crops any photo to a small square WebP", async () => {
    const photo = await sharp({ create: { width: 900, height: 400, channels: 3, background: "#5865f2" } }).jpeg().toBuffer();
    const avatar = await normalizeAvatarImage(new Uint8Array(photo));
    const meta = await sharp(avatar).metadata();
    expect(meta.format).toBe("webp");
    expect([meta.width, meta.height]).toEqual([256, 256]);
  });

  it("drops camera metadata such as GPS", async () => {
    const photo = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#ffffff" } })
      .jpeg()
      .withExif({ IFD0: { Make: "PhoneCam" } })
      .toBuffer();
    expect((await sharp(photo).metadata()).exif).toBeDefined();
    const meta = await sharp(await normalizeAvatarImage(new Uint8Array(photo))).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it("rejects files that are not images by their real bytes", async () => {
    await expect(normalizeAvatarImage(new TextEncoder().encode("%PDF-1.7 fake"))).rejects.toMatchObject({ status: 415 });
    await expect(normalizeAvatarImage(new TextEncoder().encode("<svg></svg>"))).rejects.toMatchObject({ status: 415 });
  });

  it("rejects files above the size limit", async () => {
    await expect(normalizeAvatarImage(new Uint8Array(maxAvatarUploadBytes + 1))).rejects.toMatchObject({ status: 413 });
  });

  it("rejects a corrupt image that only has a valid header", async () => {
    const header = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    await expect(normalizeAvatarImage(header)).rejects.toMatchObject({ status: 415 });
  });
});

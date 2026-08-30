/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ media-validation.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { describe, expect, it } from "vitest";
import {
  matchesSignature,
  safeFilename,
  updateMediaAltTextSchema,
  uploadRequestSchema,
} from "@/server/media/validation";
import { parseClamdResponse } from "@/server/media/malware";

describe("media upload validation", () => {
  it("enforces the image size limit", () => {
    expect(
      uploadRequestSchema.safeParse({
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 10 * 1024 * 1024,
      }).success,
    ).toBe(true);
    expect(
      uploadRequestSchema.safeParse({
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 10 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false);
  });
  it("rejects mismatched extensions", () => {
    expect(
      uploadRequestSchema.safeParse({
        filename: "catalog.jpg",
        mimeType: "application/pdf",
        sizeBytes: 100,
      }).success,
    ).toBe(false);
  });
  it("rejects executable, SVG, oversized PDF, empty and unknown fields", () => {
    expect(
      uploadRequestSchema.safeParse({
        filename: "shell.php",
        mimeType: "application/x-php",
        sizeBytes: 100,
      }).success,
    ).toBe(false);
    expect(
      uploadRequestSchema.safeParse({
        filename: "vector.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 100,
      }).success,
    ).toBe(false);
    expect(
      uploadRequestSchema.safeParse({
        filename: "catalog.pdf",
        mimeType: "application/pdf",
        sizeBytes: 20 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false);
    expect(
      uploadRequestSchema.safeParse({
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 0,
      }).success,
    ).toBe(false);
    expect(
      uploadRequestSchema.safeParse({
        filename: "photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        objectKey: "../../owned",
      }).success,
    ).toBe(false);
  });
  it("checks supported signatures", () => {
    expect(
      matchesSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"),
    ).toBe(true);
    expect(
      matchesSignature(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      matchesSignature(new TextEncoder().encode("RIFF0000WEBP"), "image/webp"),
    ).toBe(true);
    expect(
      matchesSignature(
        new TextEncoder().encode("%PDF-1.7\nbody\n%%EOF"),
        "application/pdf",
      ),
    ).toBe(true);
    expect(
      matchesSignature(
        new TextEncoder().encode("<script>alert(1)</script>"),
        "image/jpeg",
      ),
    ).toBe(false);
    expect(
      matchesSignature(
        new TextEncoder().encode("%PDF-1.7 without trailer"),
        "application/pdf",
      ),
    ).toBe(false);
  });
  it("removes unsafe filename characters", () => {
    expect(safeFilename("../bad\\name\u0000.jpg")).toBe(".._bad_name_.jpg");
  });
  it("validates and normalizes image alternative text", () => {
    expect(
      updateMediaAltTextSchema.parse({
        altText: "  ทีมช่างติดตั้งเครื่องปรับอากาศ  ",
      }).altText,
    ).toBe("ทีมช่างติดตั้งเครื่องปรับอากาศ");
    expect(updateMediaAltTextSchema.safeParse({ altText: null }).success).toBe(
      true,
    );
    expect(
      updateMediaAltTextSchema.safeParse({ altText: "ก".repeat(501) }).success,
    ).toBe(false);
    expect(
      updateMediaAltTextSchema.safeParse({
        altText: "รูปภาพ",
        unexpected: true,
      }).success,
    ).toBe(false);
  });
});

describe("malware scanner response", () => {
  it("accepts a clean ClamAV response", () => {
    expect(parseClamdResponse("stream: OK\0")).toEqual({ status: "clean" });
  });

  it("identifies an infected response without exposing it to users", () => {
    expect(parseClamdResponse("stream: Eicar-Signature FOUND\0")).toEqual({
      status: "infected",
      signature: "Eicar-Signature",
    });
  });

  it("rejects malformed and scanner-error responses", () => {
    expect(() => parseClamdResponse("stream: size limit exceeded. ERROR\0")).toThrow(
      "MALWARE_SCANNER_INVALID_RESPONSE",
    );
  });
});

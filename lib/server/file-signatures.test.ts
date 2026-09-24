import { describe, expect, it } from "vitest";
import { detectUploadSignature, type UploadFileKind } from "@/lib/server/file-signatures";

const everything: UploadFileKind[] = ["png", "jpg", "webp", "pdf"];

function bytesOf(...values: number[]) {
  return new Uint8Array(values);
}

function textBytes(text: string, length = text.length) {
  const bytes = new Uint8Array(length);
  bytes.set(new TextEncoder().encode(text));
  return bytes;
}

describe("detectUploadSignature", () => {
  it("อ่านชนิดไฟล์จากไบต์เปิดหัวของแต่ละรูปแบบ", () => {
    expect(detectUploadSignature(bytesOf(137, 80, 78, 71, 13, 10, 26, 10, 0, 0), everything)).toEqual({ extension: "png", mimeType: "image/png" });
    expect(detectUploadSignature(bytesOf(0xff, 0xd8, 0xff, 0xe0), everything)).toEqual({ extension: "jpg", mimeType: "image/jpeg" });
    expect(detectUploadSignature(textBytes("%PDF-1.7"), everything)).toEqual({ extension: "pdf", mimeType: "application/pdf" });
  });

  it("อ่าน WebP จากคอนเทนเนอร์ RIFF ซึ่งชนิดจริงอยู่ที่ไบต์ที่ 8", () => {
    const webp = new Uint8Array(16);
    webp.set(new TextEncoder().encode("RIFF"), 0);
    webp.set(new TextEncoder().encode("WEBP"), 8);
    expect(detectUploadSignature(webp, everything)).toEqual({ extension: "webp", mimeType: "image/webp" });
    // RIFF อย่างเดียวเป็นได้หลายชนิด เช่น WAV จึงต้องไม่ผ่าน
    const wav = new Uint8Array(16);
    wav.set(new TextEncoder().encode("RIFF"), 0);
    wav.set(new TextEncoder().encode("WAVE"), 8);
    expect(detectUploadSignature(wav, everything)).toBeNull();
  });

  it("ปฏิเสธชนิดที่ไม่อยู่ใน allowlist ของเส้นทางนั้น", () => {
    const pdf = textBytes("%PDF-1.7");
    expect(detectUploadSignature(pdf, everything)).not.toBeNull();
    // รูปพัสดุรับเฉพาะรูปภาพ PDF จึงต้องถูกปฏิเสธแม้จะเป็นไฟล์ที่ถูกต้อง
    expect(detectUploadSignature(pdf, ["png", "jpg"])).toBeNull();
  });

  it("ปฏิเสธไฟล์ที่ไม่รู้จักและไฟล์ที่สั้นเกินกว่าจะมีลายเซ็นครบ", () => {
    expect(detectUploadSignature(bytesOf(0x00, 0x01, 0x02, 0x03), everything)).toBeNull();
    // ไฟล์ว่างและไฟล์ที่มีแค่ไบต์แรกของ PNG ต้องไม่ถูกนับว่าเป็น PNG
    expect(detectUploadSignature(new Uint8Array(0), everything)).toBeNull();
    expect(detectUploadSignature(bytesOf(137, 80, 78), everything)).toBeNull();
    // สคริปต์ที่เปลี่ยนนามสกุลเป็น .png ยังต้องถูกจับได้จากไบต์จริง
    expect(detectUploadSignature(textBytes("<?php system($_GET[0]); ?>"), everything)).toBeNull();
  });
});

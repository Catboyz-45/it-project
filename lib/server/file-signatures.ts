// ตรวจชนิดไฟล์ที่อัปโหลดจากไบต์จริง ไม่เชื่อนามสกุลหรือ Content-Type ที่เบราว์เซอร์แจ้งมา
// เพราะทั้งสองอย่างนั้นผู้ส่งแก้ได้ตามใจ ใช้ที่เดียวกันทุกเส้นทางอัปโหลด
// จะได้ไม่มีเส้นไหนหลุดไปรับชนิดที่เส้นอื่นปฏิเสธ

export type UploadFileKind = "png" | "jpg" | "webp" | "pdf";

export type FileSignature = { extension: UploadFileKind; mimeType: string };

const signatures: Record<UploadFileKind, FileSignature> = {
  png: { extension: "png", mimeType: "image/png" },
  jpg: { extension: "jpg", mimeType: "image/jpeg" },
  webp: { extension: "webp", mimeType: "image/webp" },
  pdf: { extension: "pdf", mimeType: "application/pdf" },
};

// ไบต์เปิดหัวไฟล์ PNG ตามสเปก คือ \x89PNG\r\n\x1a\n
const pngMagic = [137, 80, 78, 71, 13, 10, 26, 10];

function startsWithText(bytes: Uint8Array, text: string, offset = 0) {
  if (bytes.length < offset + text.length) return false;
  return new TextDecoder().decode(bytes.slice(offset, offset + text.length)) === text;
}

function detectKind(bytes: Uint8Array): UploadFileKind | null {
  if (bytes.length >= pngMagic.length && pngMagic.every((value, index) => bytes[index] === value)) return "png";
  // JPEG เริ่มด้วย SOI (FFD8) ตามด้วยมาร์กเกอร์ถัดไปที่ขึ้นต้นด้วย FF เสมอ
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  // WebP เป็นคอนเทนเนอร์ RIFF ชนิดจริงอยู่ที่ไบต์ที่ 8 ถึง 12
  if (startsWithText(bytes, "RIFF") && startsWithText(bytes, "WEBP", 8)) return "webp";
  if (startsWithText(bytes, "%PDF-")) return "pdf";
  return null;
}

// คืน null เมื่อไม่ใช่ชนิดที่อนุญาต ผู้เรียกเป็นคนตัดสินใจว่าจะตอบ error แบบไหน
// allowed ทำหน้าที่เป็น allowlist ของแต่ละเส้นทาง เช่นรูปพัสดุรับแค่ PNG กับ JPG
export function detectUploadSignature(bytes: Uint8Array, allowed: readonly UploadFileKind[]): FileSignature | null {
  const kind = detectKind(bytes);
  if (!kind || !allowed.includes(kind)) return null;
  return signatures[kind];
}

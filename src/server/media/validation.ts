/**
 * หน้าที่ของไฟล์นี้: ระบบสื่อ validation ดูแลการตรวจไฟล์ ประมวลผล อ้างอิง หรือวงจรชีวิตของรูปภาพและ PDF
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { z } from "zod";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PDF_TYPE = "application/pdf";
export const updateMediaAltTextSchema = z
  .object({
    altText: z.string().trim().max(500).nullable(),
  })
  .strict();
export const uploadRequestSchema = z
  .object({
    filename: z.string().trim().min(1).max(255),
    mimeType: z.enum([...IMAGE_TYPES, PDF_TYPE]),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(20 * 1024 * 1024),
    altText: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const image = value.mimeType.startsWith("image/");
    if (image && value.sizeBytes > 10 * 1024 * 1024)
      context.addIssue({
        code: "custom",
        path: ["sizeBytes"],
        message: "รูปภาพต้องไม่เกิน 10 MB",
      });
    const extension = value.filename.toLowerCase().split(".").pop();
    const valid = image
      ? (
          {
            "image/jpeg": ["jpg", "jpeg"],
            "image/png": ["png"],
            "image/webp": ["webp"],
          } as Record<string, string[]>
        )[value.mimeType]?.includes(extension ?? "")
      : extension === "pdf";
    if (!valid)
      context.addIssue({
        code: "custom",
        path: ["filename"],
        message: "นามสกุลไฟล์ไม่ตรงกับชนิดไฟล์",
      });
  });

/** ฟังก์ชันสาธารณะ matchesSignature เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function matchesSignature(data: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg")
    return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (mimeType === "image/png")
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => data[index] === value,
    );
  if (mimeType === "image/webp")
    return (
      new TextDecoder().decode(data.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(data.slice(8, 12)) === "WEBP"
    );
  return (
    new TextDecoder().decode(data.slice(0, 5)) === "%PDF-" &&
    new TextDecoder().decode(data.slice(-1024)).includes("%%EOF")
  );
}

/** ฟังก์ชันสาธารณะ safeFilename เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function safeFilename(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f/\\]/g, "_")
    .slice(0, 255);
}

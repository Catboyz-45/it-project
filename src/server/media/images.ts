/**
 * หน้าที่ของไฟล์นี้: ระบบสื่อ images ดูแลการตรวจไฟล์ ประมวลผล อ้างอิง หรือวงจรชีวิตของรูปภาพและ PDF
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import sharp from "sharp";

export type GeneratedImage = { format: "WEBP" | "AVIF"; width: number; height: number; mimeType: string; data: Uint8Array };
/** ฟังก์ชันสาธารณะ optimizeImage เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export async function optimizeImage(input: Uint8Array): Promise<{ width: number; height: number; variants: GeneratedImage[] }> {
  const source = sharp(input, { failOn: "warning", limitInputPixels: 40_000_000 }).rotate();
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height || !["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("INVALID_IMAGE");
  const widths = [...new Set([320, 640, 1280, Math.min(1920, metadata.width)].filter(width => width <= metadata.width!))].sort((a, b) => a - b);
  const variants: GeneratedImage[] = [];
  for (const width of widths) {
    const resized = sharp(input, { failOn: "warning", limitInputPixels: 40_000_000 }).rotate().resize({ width, withoutEnlargement: true });
    const [webp, avif] = await Promise.all([resized.clone().webp({ quality: 82, effort: 4 }).toBuffer({ resolveWithObject: true }), resized.clone().avif({ quality: 60, effort: 4 }).toBuffer({ resolveWithObject: true })]);
    variants.push({ format: "WEBP", width: webp.info.width, height: webp.info.height, mimeType: "image/webp", data: webp.data }, { format: "AVIF", width: avif.info.width, height: avif.info.height, mimeType: "image/avif", data: avif.data });
  }
  return { width: metadata.width, height: metadata.height, variants };
}

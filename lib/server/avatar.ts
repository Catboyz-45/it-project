import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { detectUploadSignature } from "@/lib/server/file-signatures";

export const maxAvatarUploadBytes = 5 * 1024 * 1024;
// แสดงใหญ่สุดราว 64px บนจอความละเอียดสูง 256px จึงคมพอและไฟล์เล็ก
const avatarSize = 256;

// ตรวจไบต์จริงก่อน แล้ววาดใหม่เป็น WebP สี่เหลี่ยมจัตุรัส
// การวาดใหม่ทิ้งข้อมูลแฝงในไฟล์ทั้งหมด เช่นพิกัด GPS จากกล้องมือถือ และตัดโค้ดแปลกปลอมที่ซ่อนมาในไฟล์รูป
export async function normalizeAvatarImage(bytes: Uint8Array) {
  if (bytes.byteLength > maxAvatarUploadBytes) throw new ApiError(413, "รูปต้องมีขนาดไม่เกิน 5 MB");
  if (!detectUploadSignature(bytes, ["png", "jpg", "webp"])) throw new ApiError(415, "รองรับเฉพาะรูป PNG, JPG และ WebP");
  try {
    return await sharp(bytes, { limitInputPixels: 40_000_000 })
      // หมุนตามข้อมูลการถือกล้อง รูปจากมือถือจะได้ไม่ตะแคง
      .rotate()
      .resize(avatarSize, avatarSize, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ApiError(415, "อ่านรูปนี้ไม่ได้ ลองใช้รูปอื่น");
  }
}

// เก็บรูปใหม่ก่อน แล้วค่อยชี้บัญชีไปที่รูปใหม่ สุดท้ายลบรูปเก่า
// บันทึกฐานข้อมูลพลาดก็ลบรูปใหม่ทิ้ง ไม่เหลือไฟล์กำพร้า
export async function replaceUserAvatar(userId: string, image: Buffer) {
  const storage = getStorageAdapter();
  const avatarKey = `avatars/${userId}/${randomUUID()}.webp`;
  await storage.put(avatarKey, image, "image/webp");
  let previousKey: string | null;
  try {
    previousKey = await getDatabase().$transaction(async (tx) => {
      const current = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarKey: true } });
      await tx.user.update({ where: { id: userId }, data: { avatarKey } });
      return current.avatarKey;
    });
  } catch (error) {
    await storage.delete(avatarKey);
    throw error;
  }
  if (previousKey) await storage.delete(previousKey).catch(() => undefined);
  return avatarKey;
}

export async function removeUserAvatar(userId: string) {
  const current = await getDatabase().user.findUniqueOrThrow({ where: { id: userId }, select: { avatarKey: true } });
  if (!current.avatarKey) return;
  await getDatabase().user.update({ where: { id: userId }, data: { avatarKey: null } });
  await getStorageAdapter().delete(current.avatarKey).catch(() => undefined);
}

export async function getUserAvatarKey(userId: string) {
  const user = await getDatabase().user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
  return user?.avatarKey ?? null;
}

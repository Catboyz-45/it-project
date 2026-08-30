/**
 * หน้าที่ของไฟล์นี้: ชั้น service public-redirect.service รวมกฎธุรกิจและประสานฐานข้อมูล การตรวจสิทธิ์ และผลลัพธ์ที่ส่งให้หน้า/API
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { permanentRedirect } from "next/navigation";
import { RedirectRepository } from "@/server/repositories/redirect.repository";

const allowed = /^\/(services|products|projects|news)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** ฟังก์ชันสาธารณะ redirectOldSlug เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export async function redirectOldSlug(fromPath: string, targetIsPublic: (slug: string) => Promise<unknown>) {
  if (!allowed.test(fromPath)) return;
  const repository = new RedirectRepository(); const record = await repository.findActive(fromPath);
  if (!record || !allowed.test(record.toPath) || record.toPath.split("/")[1] !== fromPath.split("/")[1]) return;
  const targetSlug = record.toPath.split("/").at(-1); if (!targetSlug || !(await targetIsPublic(targetSlug))) return;
  await repository.recordHit(record.id).catch(() => undefined); permanentRedirect(record.toPath);
}

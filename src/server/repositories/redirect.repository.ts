/**
 * หน้าที่ของไฟล์นี้: ชั้น repository redirect.repository เป็นจุดอ่านและเขียนฐานข้อมูลของโดเมนนี้ เพื่อไม่ให้ UI ติดต่อฐานข้อมูลโดยตรง
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { db } from "@/server/db/client";

export class RedirectRepository {
  findActive(fromPath: string) {
    return db.redirect.findFirst({ where: { fromPath, isActive: true } });
  }

  upsertPermanent(fromPath: string, toPath: string) {
    return db.redirect.upsert({
      where: { fromPath },
      create: { fromPath, toPath, statusCode: 301, isActive: true },
      update: { toPath, statusCode: 301, isActive: true },
    });
  }

  recordHit(id: string) {
    return db.redirect.update({ where: { id }, data: { hitCount: { increment: 1 }, lastHitAt: new Date() } });
  }
}

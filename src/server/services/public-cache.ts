/**
 * หน้าที่ของไฟล์นี้: ชั้น service public-cache รวมกฎธุรกิจและประสานฐานข้อมูล การตรวจสิทธิ์ และผลลัพธ์ที่ส่งให้หน้า/API
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import "server-only";
import { revalidateTag } from "next/cache";
import type { ContentKind } from "@/server/cms/schemas";

/** ยกเลิกหรือล้างข้อมูลผ่าน invalidatePublicContent; โค้ดส่วนนี้คำนึงถึงการอ้างอิงและผลกระทบก่อนเปลี่ยนข้อมูล */
export function invalidatePublicContent(kind?: ContentKind) {
  revalidateTag("public-content", "max");
  if (kind) revalidateTag(kind, "max");
}

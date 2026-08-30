/**
 * หน้าที่ของไฟล์นี้: ชั้น service rules รวมกฎธุรกิจและประสานฐานข้อมูล การตรวจสิทธิ์ และผลลัพธ์ที่ส่งให้หน้า/API
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { ContentStatus } from "@prisma/client";
const allowed: Record<ContentStatus, ContentStatus[]> = { DRAFT: [ContentStatus.PUBLISHED, ContentStatus.ARCHIVED], PUBLISHED: [ContentStatus.DRAFT, ContentStatus.ARCHIVED], ARCHIVED: [ContentStatus.DRAFT] };
/** คำนวณวันลบถาวรเป็น 30 วันหลังย้ายลงถังขยะ เพื่อให้มีช่วงเวลากู้คืน */
export function retentionDate(now = new Date()) { return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); }
/** ตรวจเงื่อนไขผ่าน canTransition; คืนผลสำเร็จเฉพาะเมื่อข้อมูลตรงกฎที่ระบบยอมรับ */
export function canTransition(from: ContentStatus, to: ContentStatus) { return from === to || allowed[from].includes(to); }
/** เลือกเวลาเผยแพร่ข่าว: ใช้เวลาที่ระบุ หรือเวลาปัจจุบันเมื่อเผยแพร่ครั้งแรก */
export function newsPublicationDate(requested: Date | null | undefined, status: ContentStatus, previous?: Date | null) {
  if (requested) return requested;
  if (status === ContentStatus.PUBLISHED) return previous ?? new Date();
  return null;
}

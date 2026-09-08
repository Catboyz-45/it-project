/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นชั้นเข้าถึงข้อมูลสำหรับ “property repository” เพื่อไม่ให้หน้าจอหรือ route ติดต่อฐานข้อมูลโดยตรง
 * การทำงาน: รวมคำสั่งอ่านและเขียนข้อมูลไว้จุดเดียว เลือกเฉพาะฟิลด์ที่จำเป็น และเปิดทางให้ตรวจสิทธิ์/transaction ใน service ชั้นบน
 */

import { getDatabase } from "@/lib/server/db";

export const propertyRepository = {
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “find Workspace” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
findWorkspace(propertyId: string) {
    return getDatabase().property.findUnique({
      where: { id: propertyId },
      select: {
        id: true, name: true, shortName: true, isActive: true,
        settings: true, subscription: true,
        _count: { select: { buildings: true, rooms: true, occupancies: true } },
      },
    });
  },
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Identity” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - data: ข้อมูลที่ฟังก์ชันนำไปประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
updateIdentity(propertyId: string, data: { name?: string; shortName?: string }) {
    return getDatabase().property.update({
      where: { id: propertyId },
      data,
      select: { id: true, name: true, shortName: true, isActive: true },
    });
  },
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “upsert Settings” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - data: ข้อมูลที่ฟังก์ชันนำไปประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
upsertSettings(propertyId: string, data: Parameters<ReturnType<typeof getDatabase>["propertySettings"]["upsert"]>[0]["create"]) {
    return getDatabase().propertySettings.upsert({
      where: { propertyId },
      create: data,
      update: data,
    });
  },
};

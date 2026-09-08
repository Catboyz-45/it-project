/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “property catalogs” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { z } from "zod";

const money = z.coerce.number().finite().min(0).max(10_000_000);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “property Catalog Schema” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - context: ข้อมูลประกอบของ route เช่นค่าจาก URL
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export const propertyCatalogSchema = z.object({
  roomTypes: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    rent: money,
    deposit: money,
    capacity: z.number().int().min(1).max(100),
  }).strict()).max(200),
  serviceCharges: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    amount: money,
    frequency: z.enum(["monthly", "once"]),
    calculation: z.enum(["room", "person"]),
  }).strict()).max(200),
  furnitureOptions: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    isDefault: z.boolean(),
  }).strict()).max(200),
}).strict().superRefine((value, context) => {
  for (const [key, rows] of Object.entries(value)) {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “names” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - row: ค่า “row” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const names = rows.map((row) => row.name.toLocaleLowerCase("th-TH"));
    if (new Set(names).size !== names.length) context.addIssue({ code: "custom", path: [key], message: "ชื่อรายการต้องไม่ซ้ำกัน" });
  }
});

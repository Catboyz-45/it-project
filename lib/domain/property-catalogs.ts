import { z } from "zod";

const money = z.coerce.number().min(0).max(10_000_000);

// ตรวจรายการตั้งค่าของหอ ประเภทห้อง ค่าบริการ และเฟอร์นิเจอร์
// จำกัดอย่างละ 200 รายการ กันส่งรายการยาวมาถล่มเซิร์ฟเวอร์
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
// ชื่อในแต่ละรายการต้องไม่ซ้ำกัน ไม่งั้นผู้ใช้จะแยกไม่ออกตอนเลือกในเมนู
// วนทั้งสามรายการด้วยโค้ดชุดเดียว เพราะกฎเหมือนกันหมด
}).strict().superRefine((value, context) => {
  for (const [key, rows] of Object.entries(value)) {
    // เทียบแบบไม่สนตัวพิมพ์ใหญ่เล็ก ตามกฎของภาษาไทย
    const names = rows.map((row) => row.name.toLocaleLowerCase("th-TH"));
    // ขนาดของ Set น้อยกว่าจำนวนรายการ แปลว่ามีชื่อซ้ำ
    if (new Set(names).size !== names.length) context.addIssue({ code: "custom", path: [key], message: "ชื่อรายการต้องไม่ซ้ำกัน" });
  }
});

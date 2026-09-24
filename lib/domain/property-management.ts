import { z } from "zod";

const money = z.coerce.number().min(0).max(10_000_000);

// แก้ข้อมูลหอ ทุกช่องเป็น optional เพราะแก้ทีละช่องได้ แต่ต้องมีอย่างน้อยหนึ่งช่อง
export const updatePropertySchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  shortName: z.string().trim().min(1).max(80).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

// การตั้งค่าหอทั้งชุด ส่งมาครบทุกครั้งเพราะบันทึกแบบแทนที่ของเดิม
export const updatePropertySettingsSchema = z.object({
  legalName: z.string().trim().max(160).nullable().optional(),
  lessorName: z.string().trim().max(160).nullable().optional(),
  address: z.string().trim().min(1).max(1000),
  contactPhone: z.string().trim().min(1).max(30),
  contactEmail: z.string().trim().toLowerCase().pipe(z.email().max(254)).nullable().optional(),
  // เบอร์โทร 10 หลักหรือเลขประจำตัว 13 หลัก เอาเฉพาะตัวเลข เพราะต้องเอาไปสร้าง QR พร้อมเพย์
  promptPayId: z.string().trim().regex(/^\d{10,15}$/).nullable().optional(),
  waterUnitRate: money,
  electricityUnitRate: money,
  // วันออกบิลได้ถึงแค่ 28 เพราะกุมภาพันธ์มี 28 วัน ตั้ง 30 แล้วบางเดือนจะไม่มีวันนั้น
  billingDay: z.number().int().min(1).max(28),
  // วันครบกำหนดถึง 31 ได้ เพราะเป็นวันที่คำนวณต่อจากวันออกบิล ไม่ได้ต้องมีอยู่ทุกเดือน
  dueDay: z.number().int().min(1).max(31),
  lateFeePerDay: money,
  lateFeeCap: money.nullable().optional(),
  invoicePrefix: z.string().trim().min(1).max(20),
  invoiceFooter: z.string().trim().max(2000).nullable().optional(),
  houseRules: z.string().trim().max(20_000).nullable().optional(),
  emergencyContact: z.string().trim().max(500).nullable().optional(),
}).strict();

// ผู้ดูแลระบบแก้ได้แค่สองอย่าง เปิดปิดหอ กับตั้งว่าใครดูแล ไม่ยุ่งกับการตั้งค่าภายในของหอ
export const superAdminPropertyUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  memberUserIds: z.array(z.cuid()).max(50).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

export const updateTenantProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(8).max(30).optional(),
  address: z.string().trim().max(1000).nullable().optional(),
  emergencyName: z.string().trim().max(160).nullable().optional(),
  emergencyPhone: z.string().trim().max(30).nullable().optional(),
  // ส่ง null มาได้ หมายถึงไม่มีรถ ต่างจากไม่ส่งมาเลยซึ่งแปลว่าไม่ได้แก้ส่วนนี้
  vehicle: z.object({
    type: z.enum(["MOTORCYCLE", "CAR", "BICYCLE", "OTHER"]),
    licensePlate: z.string().trim().min(1).max(30),
    province: z.string().trim().max(80).nullable().optional(),
    brandModel: z.string().trim().max(120).nullable().optional(),
    color: z.string().trim().max(80).nullable().optional(),
    detail: z.string().trim().max(500).nullable().optional(),
  }).strict().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลให้แก้ไข");

export const endOccupancySchema = z.object({
  reason: z.string().trim().min(1).max(500),
}).strict();

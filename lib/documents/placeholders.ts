import { z } from "zod";
import type { DocumentKind } from "@/lib/documents/types";

// สามช่องนี้มีในเอกสารทุกชนิด แยกออกมาไม่ให้เขียนซ้ำ
const commonFields = {
  property_name: z.string().trim().min(1).max(160),
  room_number: z.string().trim().min(1).max(20),
  tenant_name: z.string().trim().min(1).max(160),
} as const;

// ตรวจข้อมูลที่จะถูกแทนลงในช่อง {{...}} ของ Template
// strict จึงปฏิเสธช่องที่ไม่รู้จัก กันการแอบยัดค่าอื่นเข้าไปในเอกสาร
export const contractDataSchema = z.object({
  ...commonFields,
  reference_id: z.string().trim().min(1).max(80),
  tenant_phone: z.string().trim().max(30),
  tenant_address: z.string().trim().max(500),
  start_date: z.iso.date(),
  end_date: z.iso.date(),
  rent_amount: z.number().nonnegative().max(10_000_000),
  deposit_amount: z.number().nonnegative().max(10_000_000),
}).strict();

export const invoiceDataSchema = z.object({
  ...commonFields,
  reference_id: z.string().trim().min(1).max(80),
  billing_month: z.string().trim().min(1).max(40),
  rent_amount: z.number().nonnegative().max(10_000_000),
  water_amount: z.number().nonnegative().max(10_000_000),
  electricity_amount: z.number().nonnegative().max(10_000_000),
  service_amount: z.number().nonnegative().max(10_000_000),
  // ยอดรวมเพดานสูงกว่าช่องอื่น เพราะเป็นผลบวกของทุกช่อง
  total_amount: z.number().nonnegative().max(50_000_000),
}).strict();

// ใบเสร็จออกจากบิลที่ชำระแล้วเท่านั้น ข้อมูลประกอบที่ฝั่งเซิร์ฟเวอร์จากบิลจริง
// reference_id คือเลขใบเสร็จ ส่วน invoice_number อ้างกลับไปที่บิลต้นทาง
export const receiptDataSchema = z.object({
  ...commonFields,
  reference_id: z.string().trim().min(1).max(80),
  invoice_number: z.string().trim().min(1).max(80),
  billing_month: z.string().trim().min(1).max(40),
  paid_date: z.iso.date(),
  payment_method: z.string().trim().min(1).max(80),
  rent_amount: z.number().nonnegative().max(10_000_000),
  water_amount: z.number().nonnegative().max(10_000_000),
  electricity_amount: z.number().nonnegative().max(10_000_000),
  service_amount: z.number().nonnegative().max(10_000_000),
  late_fee_amount: z.number().nonnegative().max(10_000_000),
  total_amount: z.number().nonnegative().max(50_000_000),
}).strict();

export type ContractDocumentData = z.infer<typeof contractDataSchema>;
export type InvoiceDocumentData = z.infer<typeof invoiceDataSchema>;
export type ReceiptDocumentData = z.infer<typeof receiptDataSchema>;
export type DocumentData = ContractDocumentData | InvoiceDocumentData | ReceiptDocumentData;

// ชื่อไทยของแต่ละช่อง ใช้แสดงในปุ่มแทรกช่องของตัวแก้ไข Template
export const placeholderLabels: Record<DocumentKind, Record<string, string>> = {
  contract: {
    property_name: "ชื่อหอพัก", room_number: "เลขห้อง", tenant_name: "ชื่อผู้เช่า",
    tenant_phone: "เบอร์โทร", tenant_address: "ที่อยู่", start_date: "วันเริ่มสัญญา",
    end_date: "วันสิ้นสุดสัญญา", rent_amount: "ค่าเช่า", deposit_amount: "เงินประกัน",
    reference_id: "เลขอ้างอิง",
  },
  invoice: {
    property_name: "ชื่อหอพัก", room_number: "เลขห้อง", tenant_name: "ชื่อผู้เช่า",
    billing_month: "รอบบิล", rent_amount: "ค่าเช่า", water_amount: "ค่าน้ำ",
    electricity_amount: "ค่าไฟ", service_amount: "ค่าบริการ", total_amount: "ยอดรวม",
    reference_id: "เลขบิล",
  },
  receipt: {
    property_name: "ชื่อหอพัก", room_number: "เลขห้อง", tenant_name: "ชื่อผู้ชำระ",
    reference_id: "เลขที่ใบเสร็จ", invoice_number: "เลขบิล", billing_month: "รอบบิล",
    paid_date: "วันที่ชำระ", payment_method: "วิธีชำระ", rent_amount: "ค่าเช่า",
    water_amount: "ค่าน้ำ", electricity_amount: "ค่าไฟ", service_amount: "ค่าบริการ",
    late_fee_amount: "ค่าปรับ", total_amount: "ยอดรับชำระ",
  },
};

// เลือกตัวตรวจตามชนิดเอกสาร ต้องตรวจเสมอเพราะข้อมูลมาจากฝั่งเบราว์เซอร์
export function parseDocumentData(kind: DocumentKind, value: unknown): DocumentData {
  if (kind === "contract") return contractDataSchema.parse(value);
  return kind === "receipt" ? receiptDataSchema.parse(value) : invoiceDataSchema.parse(value);
}

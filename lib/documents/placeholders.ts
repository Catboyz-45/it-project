/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: ดูแลขั้นตอนสร้างหรือจัดรูปแบบเอกสารในหัวข้อ “placeholders”
 * การทำงาน: รับข้อมูลที่ผ่านการตรวจแล้ว สร้างผลลัพธ์เอกสารอย่างสม่ำเสมอ และส่งต่อให้ storage โดยไม่เปิดเผยตำแหน่งไฟล์จริงแก่ผู้ใช้
 */

import { z } from "zod";
import type { DocumentKind } from "@/lib/documents/types";

const commonFields = {
  property_name: z.string().trim().min(1).max(160),
  room_number: z.string().trim().min(1).max(20),
  tenant_name: z.string().trim().min(1).max(160),
} as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “contract Data Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const contractDataSchema = z.object({
  ...commonFields,
  reference_id: z.string().trim().min(1).max(80),
  tenant_phone: z.string().trim().max(30),
  tenant_address: z.string().trim().max(500),
  start_date: z.string().date(),
  end_date: z.string().date(),
  rent_amount: z.number().nonnegative().max(10_000_000),
  deposit_amount: z.number().nonnegative().max(10_000_000),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “invoice Data Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const invoiceDataSchema = z.object({
  ...commonFields,
  reference_id: z.string().trim().min(1).max(80),
  billing_month: z.string().trim().min(1).max(40),
  rent_amount: z.number().nonnegative().max(10_000_000),
  water_amount: z.number().nonnegative().max(10_000_000),
  electricity_amount: z.number().nonnegative().max(10_000_000),
  service_amount: z.number().nonnegative().max(10_000_000),
  total_amount: z.number().nonnegative().max(50_000_000),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Contract Document Data” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ContractDocumentData = z.infer<typeof contractDataSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Invoice Document Data” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type InvoiceDocumentData = z.infer<typeof invoiceDataSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Document Data” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type DocumentData = ContractDocumentData | InvoiceDocumentData;

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
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “parse Document Data” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - kind: ค่า “kind” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด DocumentData ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function parseDocumentData(kind: DocumentKind, value: unknown): DocumentData {
  return kind === "contract" ? contractDataSchema.parse(value) : invoiceDataSchema.parse(value);
}

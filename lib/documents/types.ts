/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: ดูแลขั้นตอนสร้างหรือจัดรูปแบบเอกสารในหัวข้อ “types”
 * การทำงาน: รับข้อมูลที่ผ่านการตรวจแล้ว สร้างผลลัพธ์เอกสารอย่างสม่ำเสมอ และส่งต่อให้ storage โดยไม่เปิดเผยตำแหน่งไฟล์จริงแก่ผู้ใช้
 */

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “document Kinds” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const documentKinds = ["contract", "invoice"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Document Kind” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type DocumentKind = (typeof documentKinds)[number];

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: interface “Document Template Dto” ระบุว่าข้อมูลต้องมีฟิลด์อะไร เพื่อให้หลายส่วนส่งข้อมูลตรงรูปแบบกัน
 */
export interface DocumentTemplateDto {
  html: string;
  kind: DocumentKind;
  name: string;
  updatedAt: string;
  version: number;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: interface “Stored File” ระบุว่าข้อมูลต้องมีฟิลด์อะไร เพื่อให้หลายส่วนส่งข้อมูลตรงรูปแบบกัน
 */
export interface StoredFile {
  body: Buffer;
  contentType: string;
  size: number;
}

/**
 * หน้าที่ของไฟล์นี้: ชั้น service errors รวมกฎธุรกิจและประสานฐานข้อมูล การตรวจสิทธิ์ และผลลัพธ์ที่ส่งให้หน้า/API
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
export class CmsError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_TRANSITION" | "INVALID_MEDIA" | "IN_USE" | "FORBIDDEN", message: string) { super(message); }
}

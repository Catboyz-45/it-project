import { z } from "zod";

// แยกออกมาเป็นตัวย่อย เพราะทั้งข้อความธรรมดาและข้อความที่แนบไฟล์ใช้กฎเดียวกัน
export const chatMessageBodySchema = z.string().trim().max(4000);
// id ที่ฝั่งเบราว์เซอร์สร้าง เซิร์ฟเวอร์ใช้กันบันทึกซ้ำถ้าคำขอถูกส่งมาสองรอบ
export const chatClientIdSchema = z.uuid();

export const sendChatMessageSchema = z.object({
  // เช็คความยาวหลังตัดช่องว่างแล้ว ข้อความที่มีแต่เว้นวรรคจึงไม่ผ่าน
  body: chatMessageBodySchema.refine((value) => value.length > 0, "กรุณาระบุข้อความ"),
  clientId: chatClientIdSchema,
}).strict();

// เลื่อนดูข้อความเก่าด้วยจุดอ้างอิง ไม่ใช้เลขหน้า เพราะข้อความใหม่เข้ามาแล้วเลขหน้าจะเลื่อน
export const chatCursorSchema = z.object({
  before: z.coerce.date().optional(),
  beforeMessageId: z.cuid().optional(),
  // จำกัด 100 กันขอทีเดียวเยอะจนเซิร์ฟเวอร์รับไม่ไหว coerce เพราะค่ามาจาก query string เป็นสตริง
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;

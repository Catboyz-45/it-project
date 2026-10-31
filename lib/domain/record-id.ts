import { z } from "zod";

// รหัสของแถวในฐานข้อมูลที่ Prisma สร้างด้วย @default(cuid()) ใช้ตรวจ id ที่มาจาก URL หรือ body ทุกจุด
// ใช้รูปแบบเดียวกับ z.cuid() ของ Zod ทุกตัวอักษร พฤติกรรมการตรวจจึงไม่เปลี่ยน
// แต่ไม่เรียก z.cuid() ตรง ๆ เพราะ Zod 4 ประกาศเลิกใช้แล้ว (แนะนำ cuid2 ซึ่งรูปแบบต่างจาก id ที่ Prisma สร้าง)
// รวมไว้ที่เดียว วันหน้าเปลี่ยนรูปแบบ id จะได้แก้จุดเดียว
export const recordIdSchema = z.string().regex(/^[cC][0-9a-z]{6,}$/, "รหัสไม่ถูกต้อง");

// id ผู้ใช้มีสองรูปแบบ บัญชีที่สมัครผ่านแอปได้ cuid จาก Prisma ส่วนบัญชีที่สคริปต์ admin:bootstrap
// สร้างตอนตั้งระบบได้ UUID ถ้ารับแค่ cuid เมนูจัดการบัญชีของ Super Admin จะตอบว่าไม่พบบัญชีพวกนั้นทุกครั้ง
export const userIdSchema = z.union([recordIdSchema, z.uuid({ message: "รหัสไม่ถูกต้อง" })]);

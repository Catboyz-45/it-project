/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “db” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/server/env";

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “get Database” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function getDatabase() {
  if (!globalDatabase.prisma) {
    // Force every connection to UTC at the protocol level, independent of
    // whatever timezone the Postgres server/session would otherwise default
    // to. DateTime values round-trip correctly through Prisma either way,
    // but raw SQL (e.g. scripts/bootstrap-super-admin.mjs) and any direct
    // reading of timestamptz columns depend on the session timezone; pinning
    // it here removes that dependency instead of requiring it be configured
    // correctly on whatever database this connects to.
    const pool = new pg.Pool({ connectionString: getServerEnv().DATABASE_URL, options: "-c TimeZone=UTC" });
    globalDatabase.prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  }
  return globalDatabase.prisma;
}

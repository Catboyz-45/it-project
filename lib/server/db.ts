import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/server/env";

// เก็บไว้บน globalThis เพราะตอน dev โค้ดถูกโหลดใหม่ทุกครั้งที่แก้ไฟล์
// ถ้าไม่เก็บไว้ จะสร้าง client ใหม่เรื่อย ๆ จนการเชื่อมต่อฐานข้อมูลเต็ม
const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };

// จุดเดียวที่เข้าถึงฐานข้อมูล ทุกที่ในระบบเรียกผ่านตัวนี้
export function getDatabase() {
  if (!globalDatabase.prisma) {
    // บังคับทุกการเชื่อมต่อให้ใช้เขตเวลา UTC ไม่ว่าเซิร์ฟเวอร์ฐานข้อมูลจะตั้งไว้เป็นอะไร
    // ผ่าน Prisma ค่า DateTime ถูกต้องอยู่แล้วทั้งสองทาง แต่ SQL ดิบกับการอ่านคอลัมน์ timestamptz ตรง ๆ
    // จะขึ้นกับเขตเวลาของ session ตรึงไว้ตรงนี้จึงตัดปัญหาไปเลย ไม่ต้องไปหวังว่าฐานข้อมูลปลายทางจะตั้งมาถูก
    // คำเตือน "client.query() when the client is already executing a query" ใน log มาจาก Prisma เอง
    // ตัวแปลงคำสั่งของมันยิงคำสั่งย่อยใน transaction พร้อมกันบนการเชื่อมต่อเดียว (ยังเป็นแบบนี้ถึง 7.10.1)
    // pg 8 ยังต่อคิวให้จึงทำงานถูก ห้ามขยับ pg ไปรุ่น 9 จนกว่า Prisma จะแก้ ไม่งั้นคำสั่งใน transaction จะพัง
    const pool = new pg.Pool({ connectionString: getServerEnv().DATABASE_URL, options: "-c TimeZone=UTC" });
    globalDatabase.prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  }
  return globalDatabase.prisma;
}

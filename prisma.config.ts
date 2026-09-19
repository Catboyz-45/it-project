
// คำสั่ง prisma รันนอก Next จึงต้องโหลด .env เองก่อน ไม่งั้นจะไม่เห็น DATABASE_URL
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // ค่าสำรองไว้กัน prisma ล้มตอนรันคำสั่งที่ไม่ต้องต่อฐานข้อมูลจริง เช่น generate
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://unused:unused@localhost:5432/unused" },
});

import "dotenv/config";
import { randomBytes, randomUUID, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

// สร้างบัญชีซูเปอร์แอดมินตัวแรก ต้องมีคนแรกก่อนถึงจะเข้าไปสร้างคนอื่นต่อได้
// ใช้ pg ตรงแทน Prisma เพราะต้องรันได้ตั้งแต่ตอนที่แอปยัง build ไม่เสร็จ
const { Pool } = pg;
const scrypt = promisify(nodeScrypt);
const databaseUrl = process.env.DATABASE_URL;
// อ่านทุกอย่างจาก env ไม่ฝังรหัสผ่านไว้ในไฟล์
// แปลงอีเมลเป็นตัวพิมพ์เล็กให้ตรงกับที่ระบบเก็บ จะได้ไม่เกิดบัญชีซ้ำเพราะพิมพ์ต่างกัน
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const displayName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "แอดมินใหญ่";
const propertyAdminEmail = process.env.DEMO_PROPERTY_ADMIN_EMAIL?.trim().toLowerCase();
const propertyAdminPassword = process.env.DEMO_PROPERTY_ADMIN_PASSWORD;
const propertyAdminName = process.env.DEMO_PROPERTY_ADMIN_NAME?.trim() || "แอดมินประจำหอ";
const demoPropertyId = "demo-property";

// ตรวจค่าให้ครบก่อนแตะฐานข้อมูล ขาดอะไรจะได้รู้ทันทีไม่ใช่ไปพังกลางทาง
if (!databaseUrl || !email || !password) {
  throw new Error("DATABASE_URL, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required");
}
if (password.length < 12 || password.length > 128) throw new Error("Bootstrap password must contain 12-128 characters");

// ทำแฮชให้รูปแบบตรงกับ lib/server/password.ts เป๊ะ ไม่งั้นระบบจะตรวจรหัสไม่ผ่าน
// เขียนซ้ำที่นี่เพราะสคริปต์นี้รันนอกแอป ไม่ได้โหลดโค้ดฝั่งเซิร์ฟเวอร์เข้ามา
async function createPasswordHash(value) {
  // สุ่ม salt ใหม่ทุกครั้ง รหัสเดียวกันจะได้แฮชออกมาไม่ซ้ำกัน
  const salt = randomBytes(16);
  const key = await scrypt(value, salt, 64);
  return `scrypt-v1$${salt.toString("base64")}$${key.toString("base64")}`;
}

const passwordHash = await createPasswordHash(password);
const pool = new Pool({ connectionString: databaseUrl });

try {
  // ON CONFLICT ทำให้รันซ้ำได้ มีอยู่แล้วก็อัปเดตรหัสให้ ไม่ใช่พังเพราะอีเมลซ้ำ
  // ตั้ง approvalStatus เป็น APPROVED เลย เพราะไม่มีใครมาอนุมัติให้คนแรกได้
  await pool.query(
    `INSERT INTO "User" ("id", "email", "passwordHash", "displayName", "role", "isActive", "approvalStatus", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'SUPER_ADMIN', true, 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("email") DO UPDATE SET
       "passwordHash" = EXCLUDED."passwordHash",
       "displayName" = EXCLUDED."displayName",
       "role" = 'SUPER_ADMIN',
       "isActive" = true,
       "approvalStatus" = 'APPROVED',
       "updatedAt" = CURRENT_TIMESTAMP`,
    [randomUUID(), email, passwordHash, displayName],
  );
  console.log(`Super admin is ready: ${email}`);

  // ส่วนล่างนี้เป็นบัญชีเดโมสำหรับลองใช้ในเครื่อง ไม่ตั้งค่าใน env ก็ข้ามไปเลย
  if (propertyAdminEmail && propertyAdminPassword) {
    if (propertyAdminPassword.length < 12 || propertyAdminPassword.length > 128) {
      throw new Error("Demo property admin password must contain 12-128 characters");
    }
    const propertyAdminId = randomUUID();
    const propertyAdminHash = await createPasswordHash(propertyAdminPassword);
    // หอ บัญชี และการผูกสิทธิ์ ต้องสำเร็จพร้อมกันทั้งชุด
    // ได้บัญชีแต่ผูกหอไม่ติด จะกลายเป็นแอดมินที่เข้าไปแล้วไม่เห็นอะไรเลย
    await pool.query("BEGIN");
    try {
      await pool.query(
        `INSERT INTO "Property" ("id", "name", "shortName", "isActive", "createdAt", "updatedAt")
         VALUES ($1, 'หอพักทดลอง', 'หอทดลอง', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO UPDATE SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP`,
        [demoPropertyId],
      );
      // ขอ id กลับมาด้วย RETURNING เพราะถ้าเจอ conflict id ที่สุ่มไว้จะไม่ถูกใช้
      const userResult = await pool.query(
        `INSERT INTO "User" ("id", "email", "passwordHash", "displayName", "role", "isActive", "approvalStatus", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'PROPERTY_ADMIN', true, 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT ("email") DO UPDATE SET
           "passwordHash" = EXCLUDED."passwordHash",
           "displayName" = EXCLUDED."displayName",
           "role" = 'PROPERTY_ADMIN',
           "isActive" = true,
           "approvalStatus" = 'APPROVED',
           "updatedAt" = CURRENT_TIMESTAMP
         RETURNING "id"`,
        [propertyAdminId, propertyAdminEmail, propertyAdminHash, propertyAdminName],
      );
      await pool.query(
        `INSERT INTO "PropertyMembership" ("userId", "propertyId", "createdAt")
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT ("userId", "propertyId") DO NOTHING`,
        [userResult.rows[0].id, demoPropertyId],
      );
      await pool.query("COMMIT");
      console.log(`Property admin is ready: ${propertyAdminEmail}`);
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  // ปิด pool ทุกกรณี ไม่งั้นสคริปต์จะค้างไม่ยอมจบ
  await pool.end();
}

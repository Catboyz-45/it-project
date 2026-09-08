/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคำสั่งสำหรับนักพัฒนา/ระบบอัตโนมัติในงาน “bootstrap super admin”
 * การทำงาน: เรียกใช้จาก terminal หรือ package script เพื่อทำงานบำรุงรักษาที่ทำซ้ำได้; ควรทดลองในสภาพแวดล้อมที่ไม่ใช่ production ก่อนเมื่อมีการเขียนข้อมูล
 */

import "dotenv/config";
import { randomBytes, randomUUID, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const { Pool } = pg;
const scrypt = promisify(nodeScrypt);
const databaseUrl = process.env.DATABASE_URL;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const displayName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "แอดมินใหญ่";
const propertyAdminEmail = process.env.DEMO_PROPERTY_ADMIN_EMAIL?.trim().toLowerCase();
const propertyAdminPassword = process.env.DEMO_PROPERTY_ADMIN_PASSWORD;
const propertyAdminName = process.env.DEMO_PROPERTY_ADMIN_NAME?.trim() || "แอดมินประจำหอ";
const demoPropertyId = "demo-property";

if (!databaseUrl || !email || !password) {
  throw new Error("DATABASE_URL, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required");
}
if (password.length < 12 || password.length > 128) throw new Error("Bootstrap password must contain 12-128 characters");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Password Hash” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function createPasswordHash(value) {
  const salt = randomBytes(16);
  const key = await scrypt(value, salt, 64);
  return `scrypt-v1$${salt.toString("base64")}$${key.toString("base64")}`;
}

const passwordHash = await createPasswordHash(password);
const pool = new Pool({ connectionString: databaseUrl });

try {
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

  if (propertyAdminEmail && propertyAdminPassword) {
    if (propertyAdminPassword.length < 12 || propertyAdminPassword.length > 128) {
      throw new Error("Demo property admin password must contain 12-128 characters");
    }
    const propertyAdminId = randomUUID();
    const propertyAdminHash = await createPasswordHash(propertyAdminPassword);
    await pool.query("BEGIN");
    try {
      await pool.query(
        `INSERT INTO "Property" ("id", "name", "shortName", "isActive", "createdAt", "updatedAt")
         VALUES ($1, 'หอพักทดลอง', 'หอทดลอง', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO UPDATE SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP`,
        [demoPropertyId],
      );
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
  await pool.end();
}

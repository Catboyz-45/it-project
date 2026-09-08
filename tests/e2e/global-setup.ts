/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “global setup” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { randomBytes, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { e2e } from "./fixtures";

const scrypt = promisify(nodeScrypt);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “password Hash” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function passwordHash(value: string) {
  const salt = randomBytes(16);
  const key = await scrypt(value, salt, 64) as Buffer;
  return `scrypt-v1$${salt.toString("base64")}$${key.toString("base64")}`;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “global Setup” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export default async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for E2E tests");
  const url = new URL(databaseUrl);
  if (!/test/i.test(url.pathname)) throw new Error("E2E tests require a dedicated database whose name contains 'test'");

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const hash = await passwordHash(e2e.password);
  const buildingId = "cm000000000000000000009";
  const floorId = "cm000000000000000000010";
  const occupancyId = "cm000000000000000000011";
  const pendingOccupancyId = "cm000000000000000000012";
  const leaseId = "cm000000000000000000013";
  const invoiceId = "cm000000000000000000014";
  const planId = "cm000000000000000000015";

  try {
    await client.query("BEGIN");
    // The E2E database is dedicated and ephemeral. Reset throttle state so
    // repeated local/CI journeys do not influence one another by source IP.
    await client.query(`DELETE FROM "ApiRateLimit"`);
    await client.query(`DELETE FROM "LoginThrottle"`);
    const property = [e2e.propertyId];
    await client.query(`DELETE FROM "PaymentSubmission" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "InvoiceItem" WHERE "invoiceId" IN (SELECT "id" FROM "Invoice" WHERE "propertyId" = $1)`, property);
    await client.query(`DELETE FROM "Invoice" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "MeterReading" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "LeaseTenant" WHERE "leaseId" IN (SELECT "id" FROM "Lease" WHERE "propertyId" = $1)`, property);
    await client.query(`DELETE FROM "LeaseVersion" WHERE "leaseId" IN (SELECT "id" FROM "Lease" WHERE "propertyId" = $1)`, property);
    await client.query(`DELETE FROM "Lease" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "TicketAttachment" WHERE "ticketId" IN (SELECT "id" FROM "ServiceTicket" WHERE "propertyId" = $1)`, property);
    await client.query(`DELETE FROM "ServiceTicket" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "Parcel" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "AnnouncementRoom" WHERE "announcementId" IN (SELECT "id" FROM "Announcement" WHERE "propertyId" = $1)`, property);
    await client.query(`DELETE FROM "Announcement" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "ChatMessage" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "ChatConversation" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "RoomOccupancy" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "TenantInvitation" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "Room" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "Floor" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "Building" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "SubscriptionPayment" WHERE "orderId" IN (SELECT "id" FROM "SubscriptionOrder" WHERE "propertyId" = $1)`, property);
    await client.query(`DELETE FROM "SubscriptionOrder" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "PropertySubscription" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "PropertySettings" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "PropertyMembership" WHERE "propertyId" = $1`, property);
    await client.query(`DELETE FROM "Property" WHERE "id" = $1`, property);
    await client.query(`DELETE FROM "TenantProfile" WHERE "userId" = ANY($1::text[])`, [[e2e.tenantUserId, e2e.pendingUserId]]);
    await client.query(`DELETE FROM "User" WHERE "id" = ANY($1::text[])`, [[e2e.ownerId, e2e.tenantUserId, e2e.pendingUserId, e2e.superAdminId]]);

    await client.query(
      `INSERT INTO "User" ("id","email","passwordHash","displayName","role","isActive","approvalStatus","createdAt","updatedAt") VALUES
       ($1,$2,$3,'E2E Owner','PROPERTY_ADMIN',true,'APPROVED',NOW(),NOW()),
       ($4,$5,$3,'E2E Tenant','TENANT',true,'APPROVED',NOW(),NOW()),
       ($6,'e2e-pending@example.test',$3,'E2E Pending Tenant','TENANT',true,'APPROVED',NOW(),NOW()),
       ($7,$8,$3,'E2E Super Admin','SUPER_ADMIN',true,'APPROVED',NOW(),NOW())`,
      [e2e.ownerId, e2e.ownerEmail, hash, e2e.tenantUserId, e2e.tenantEmail, e2e.pendingUserId, e2e.superAdminId, e2e.superAdminEmail],
    );
    await client.query(
      `INSERT INTO "PolicyAction" ("id","userId","policyType","action","documentVersion","source","occurredAt")
       SELECT md5("id" || '-terms'), "id", 'TERMS_OF_SERVICE', 'ACCEPTED', '2026-09-06', 'REQUIRED_GATE', NOW() FROM "User" WHERE "id" = ANY($1::text[])
       UNION ALL
       SELECT md5("id" || '-privacy'), "id", 'PRIVACY_NOTICE', 'ACKNOWLEDGED', '2026-09-06', 'REQUIRED_GATE', NOW() FROM "User" WHERE "id" = ANY($1::text[])`,
      [[e2e.ownerId, e2e.tenantUserId, e2e.pendingUserId, e2e.superAdminId]],
    );
    await client.query(
      `INSERT INTO "SaasPlan" ("id","code","name","monthlyPrice","yearlyPrice","maxProperties","maxRooms","allowPromptPay","allowFileUploads","allowPrioritySupport","isActive","sortOrder","createdAt","updatedAt")
       VALUES ($1,'E2E_STANDARD','E2E Standard',990,9900,2,100,true,true,true,true,999,NOW(),NOW())
       ON CONFLICT ("code") DO UPDATE SET "allowPromptPay"=true,"allowFileUploads"=true,"isActive"=true,"updatedAt"=NOW()`,
      [planId],
    );
    const plan = await client.query<{ id: string }>(`SELECT "id" FROM "SaasPlan" WHERE "code"='E2E_STANDARD'`);
    await client.query(
      `INSERT INTO "Property" ("id","name","shortName","isActive","createdAt","updatedAt")
       VALUES ($1,'หอ E2E อยู่สบาย','E2E อยู่สบาย',true,NOW(),NOW())`,
      [e2e.propertyId],
    );
    await client.query(`INSERT INTO "PropertyMembership" ("userId","propertyId","createdAt") VALUES ($1,$2,NOW())`, [e2e.ownerId, e2e.propertyId]);
    await client.query(
      `INSERT INTO "PropertySubscription" ("propertyId","planId","planName","billingInterval","priceAmount","status","maxProperties","maxRooms","startsAt","expiresAt","createdAt","updatedAt")
       VALUES ($1,$2,'E2E Standard','MONTHLY',990,'ACTIVE',2,100,'2026-01-01','2030-01-01',NOW(),NOW())`,
      [e2e.propertyId, plan.rows[0].id],
    );
    await client.query(
      `INSERT INTO "PropertySettings" ("propertyId","address","contactPhone","contactEmail","promptPayId","waterUnitRate","electricityUnitRate","billingDay","dueDay","lateFeePerDay","lateFeeCap","invoicePrefix","houseRules","emergencyContact","createdAt","updatedAt")
       VALUES ($1,'99 ถนนทดสอบ กรุงเทพมหานคร','0800000000',$2,'0812345678',18,7,1,5,20,200,'E2E','ห้ามส่งเสียงดังหลัง 22:00 น.','0800000001',NOW(),NOW())`,
      [e2e.propertyId, e2e.ownerEmail],
    );
    await client.query(`INSERT INTO "Building" ("id","propertyId","name","code","isActive","createdAt","updatedAt") VALUES ($1,$2,'อาคาร E2E','E2E-A',true,NOW(),NOW())`, [buildingId, e2e.propertyId]);
    await client.query(`INSERT INTO "Floor" ("id","propertyId","buildingId","number","label","createdAt","updatedAt") VALUES ($1,$2,$3,1,'ชั้นทดสอบ',NOW(),NOW())`, [floorId, e2e.propertyId, buildingId]);
    await client.query(
      `INSERT INTO "Room" ("id","propertyId","buildingId","floorId","number","roomType","monthlyRent","depositAmount","capacity","status","createdAt","updatedAt") VALUES
       ($1,$3,$4,$5,'E101','Standard',3600,7200,2,'OCCUPIED',NOW(),NOW()),
       ($2,$3,$4,$5,'E102','Standard',3600,7200,2,'AVAILABLE',NOW(),NOW())`,
      [e2e.activeRoomId, e2e.pendingRoomId, e2e.propertyId, buildingId, floorId],
    );
    await client.query(
      `INSERT INTO "TenantProfile" ("id","userId","phone","createdAt","updatedAt") VALUES
       ($1,$2,'0811111111',NOW(),NOW()),($3,$4,'0822222222',NOW(),NOW())`,
      [e2e.tenantProfileId, e2e.tenantUserId, e2e.pendingProfileId, e2e.pendingUserId],
    );
    await client.query(
      `INSERT INTO "RoomOccupancy" ("id","propertyId","roomId","tenantProfileId","role","status","startedAt","approvedAt","approvedByUserId","createdAt","updatedAt") VALUES
       ($1,$3,$4,$5,'PRIMARY','ACTIVE','2026-01-01','2026-01-01',$6,NOW(),NOW()),
       ($2,$3,$7,$8,'PRIMARY','PENDING',NULL,NULL,NULL,NOW(),NOW())`,
      [occupancyId, pendingOccupancyId, e2e.propertyId, e2e.activeRoomId, e2e.tenantProfileId, e2e.ownerId, e2e.pendingRoomId, e2e.pendingProfileId],
    );
    await client.query(
      `INSERT INTO "Lease" ("id","propertyId","roomId","leaseNumber","status","startDate","endDate","monthlyRent","depositAmount","currentVersion","signedStorageKey","activatedAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,'CTR-E2E-E101','ACTIVE','2026-01-01','2026-12-31',3600,7200,1,'e2e/contracts/e101.pdf','2026-01-01',NOW(),NOW())`,
      [leaseId, e2e.propertyId, e2e.activeRoomId],
    );
    await client.query(`INSERT INTO "LeaseVersion" ("id","leaseId","version","snapshot","signedStorageKey","createdByUserId","createdAt") VALUES ('cm000000000000000000019',$1,1,'{"leaseNumber":"CTR-E2E-E101","roomNumber":"E101","tenantName":"E2E Tenant"}'::jsonb,'e2e/contracts/e101.pdf',$2,NOW())`, [leaseId, e2e.ownerId]);
    await client.query(`INSERT INTO "LeaseTenant" ("leaseId","occupancyId","isPrimary","createdAt") VALUES ($1,$2,true,NOW())`, [leaseId, occupancyId]);
    await client.query(
      `INSERT INTO "Invoice" ("id","propertyId","roomId","leaseId","invoiceNumber","billingMonth","status","issuedAt","dueDate","subtotal","lateFee","total","version","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,'E2E-202607-E101','2026-07-01','PENDING','2026-07-01','2026-07-05',4200,0,4200,1,NOW(),NOW())`,
      [invoiceId, e2e.propertyId, e2e.activeRoomId, leaseId],
    );
    await client.query(
      `INSERT INTO "InvoiceItem" ("id","invoiceId","type","description","quantity","unitPrice","amount","sortOrder","createdAt") VALUES
       ('cm000000000000000000020',$1,'RENT','ค่าห้องรายเดือน',1,3600,3600,0,NOW()),
       ('cm000000000000000000021',$1,'WATER','ค่าน้ำ',10,18,180,1,NOW()),
       ('cm000000000000000000022',$1,'ELECTRICITY','ค่าไฟ',60,7,420,2,NOW())`,
      [invoiceId],
    );
    await client.query(
      `INSERT INTO "PaymentSubmission" ("id","propertyId","invoiceId","tenantProfileId","amount","status","slipStorageKey","slipMime","slipSize","submittedAt","createdAt","updatedAt")
       VALUES ('cm000000000000000000016',$1,$2,$3,4200,'PENDING_REVIEW',NULL,NULL,NULL,NOW(),NOW(),NOW())`,
      [e2e.propertyId, invoiceId, e2e.tenantProfileId],
    );
    await client.query(
      `INSERT INTO "Announcement" ("id","propertyId","title","content","status","audience","publishedAt","createdById","createdAt","updatedAt")
       VALUES ('cm000000000000000000017',$1,'ประกาศ E2E','แจ้งทดสอบระบบสำหรับผู้เช่า','PUBLISHED','ALL_TENANTS','2026-07-01',$2,NOW(),NOW())`,
      [e2e.propertyId, e2e.ownerId],
    );
    await client.query(
      `INSERT INTO "Parcel" ("id","propertyId","roomId","status","note","registeredById","registeredAt","createdAt","updatedAt")
       VALUES ('cm000000000000000000018',$1,$2,'WAITING','พัสดุ E2E ที่เคาน์เตอร์',$3,NOW(),NOW(),NOW())`,
      [e2e.propertyId, e2e.activeRoomId, e2e.ownerId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

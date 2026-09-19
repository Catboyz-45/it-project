import { randomBytes, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { e2e } from "./fixtures";

// scrypt ของ node ใช้ callback แปลงเป็น Promise ก่อนจะได้เขียน await ได้
const scrypt = promisify(nodeScrypt);

// ทำแฮชรหัสผ่านให้รูปแบบตรงกับที่ lib/server/password.ts ใช้ เทสต์จึงล็อกอินผ่าน API จริงได้
// เขียนซ้ำที่นี่เพราะไฟล์นี้รันด้วย pg ตรง ๆ ไม่ผ่าน Prisma และไม่ได้โหลดโค้ดของแอป
async function passwordHash(value: string) {
  // สุ่ม salt ใหม่ทุกครั้ง รหัสเดียวกันจะได้แฮชออกมาไม่ซ้ำกัน
  const salt = randomBytes(16);
  const key = await scrypt(value, salt, 64) as Buffer;
  return `scrypt-v1$${salt.toString("base64")}$${key.toString("base64")}`;
}

// ลบข้อมูลทั้งหมดของหอหนึ่งหอ ไล่จากตารางลูกขึ้นไปหาตารางแม่ ลบแม่ก่อนจะติด foreign key
// ทุกคำสั่งส่งค่าผ่าน $1 ไม่ต่อสตริงเข้าไปใน SQL ตรง ๆ
async function clearProperty(client: pg.PoolClient, propertyId: string) {
  const property = [propertyId];
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
}

// รันครั้งเดียวก่อนเริ่มเทสต์ทุกไฟล์ ล้างของเก่าแล้วใส่ข้อมูลตั้งต้นชุดใหม่
export default async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for E2E tests");
  const url = new URL(databaseUrl);
  // ด่านกันพลาดที่สำคัญที่สุด ไฟล์นี้ลบข้อมูลจริง ชื่อฐานต้องมีคำว่า test เท่านั้น
  if (!/test/i.test(url.pathname)) throw new Error("E2E tests require a dedicated database whose name contains 'test'");

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const hash = await passwordHash(e2e.password);
  // ตั้งรหัสเป็นค่าตายตัว รันซ้ำจะได้ทับของเดิมพอดี ไม่เหลือข้อมูลค้างสะสม
  const buildingId = "cm000000000000000000009";
  const floorId = "cm000000000000000000010";
  const occupancyId = "cm000000000000000000011";
  const pendingOccupancyId = "cm000000000000000000012";
  const leaseId = "cm000000000000000000013";
  const invoiceId = "cm000000000000000000014";
  const planId = "cm000000000000000000015";
  const secondBuildingId = "cm000000000000000000025";
  const secondFloorId = "cm000000000000000000026";

  try {
    // ห่อทั้งหมดใน transaction เดียว พลาดกลางทางจะย้อนคืนหมด ไม่เหลือข้อมูลเตรียมไปครึ่งเดียว
    await client.query("BEGIN");
    // ล้างตัวนับการจำกัดจำนวนคำขอด้วย ไม่งั้นรันหลายรอบติดกันจะโดนบล็อกจาก IP เดิม
    await client.query(`DELETE FROM "ApiRateLimit"`);
    await client.query(`DELETE FROM "LoginThrottle"`);
    // ลบจากตารางลูกไล่ขึ้นไปหาตารางแม่ ลบแม่ก่อนจะติด foreign key
    // ทุกคำสั่งส่งค่าผ่าน $1 ไม่ต่อสตริงเข้าไปใน SQL ตรง ๆ
    await clearProperty(client, e2e.propertyId);
    await clearProperty(client, e2e.secondPropertyId);
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
    // บัญชีทดสอบต้องผ่านด่านยอมรับนโยบายมาแล้ว ไม่งั้นจะติดอยู่ที่หน้า /legal/accept
    await client.query(
      `INSERT INTO "PolicyAction" ("id","userId","policyType","action","documentVersion","source","occurredAt")
       SELECT md5("id" || '-terms'), "id", 'TERMS_OF_SERVICE'::"PolicyType", 'ACCEPTED'::"PolicyActionType", '2026-09-06', 'REQUIRED_GATE'::"PolicyActionSource", NOW() FROM "User" WHERE "id" = ANY($1::text[])
       UNION ALL
       SELECT md5("id" || '-privacy'), "id", 'PRIVACY_NOTICE'::"PolicyType", 'ACKNOWLEDGED'::"PolicyActionType", '2026-09-06', 'REQUIRED_GATE'::"PolicyActionSource", NOW() FROM "User" WHERE "id" = ANY($1::text[])`,
      [[e2e.ownerId, e2e.tenantUserId, e2e.pendingUserId, e2e.superAdminId]],
    );
    // บัญชีแอดมินตั้งต้นถูกสร้างจาก npm run admin:bootstrap คนละที่กับไฟล์นี้ และไม่ถูกลบตรงนี้
    // แต่ก็ต้องกดยอมรับนโยบายเหมือนกัน ไม่งั้นทุกเทสต์ที่ใช้บัญชีนี้จะไปติดที่หน้ายอมรับ
    // ON CONFLICT DO NOTHING ทำให้รันซ้ำกี่รอบก็ไม่พัง
    const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
    if (bootstrapEmail) {
      await client.query(
        `INSERT INTO "PolicyAction" ("id","userId","policyType","action","documentVersion","source","occurredAt")
         SELECT md5("id" || '-terms'), "id", 'TERMS_OF_SERVICE'::"PolicyType", 'ACCEPTED'::"PolicyActionType", '2026-09-06', 'REQUIRED_GATE'::"PolicyActionSource", NOW() FROM "User" WHERE "email" = $1
         UNION ALL
         SELECT md5("id" || '-privacy'), "id", 'PRIVACY_NOTICE'::"PolicyType", 'ACKNOWLEDGED'::"PolicyActionType", '2026-09-06', 'REQUIRED_GATE'::"PolicyActionSource", NOW() FROM "User" WHERE "email" = $1
         ON CONFLICT ("id") DO NOTHING`,
        [bootstrapEmail],
      );
    }
    await client.query(
      `INSERT INTO "SaasPlan" ("id","code","name","monthlyPrice","yearlyPrice","maxProperties","maxRooms","allowPromptPay","allowFileUploads","allowPrioritySupport","isActive","sortOrder","createdAt","updatedAt")
       VALUES ($1,'E2E_STANDARD','E2E Standard',990,9900,2,100,true,true,true,true,999,NOW(),NOW())
       ON CONFLICT ("code") DO UPDATE SET "allowPromptPay"=true,"allowFileUploads"=true,"isActive"=true,"updatedAt"=NOW()`,
      [planId],
    );
    // อ่านรหัสกลับมาอีกที เพราะถ้าเจอ conflict แถวเดิมจะถูกอัปเดต รหัสจึงอาจไม่ใช่ planId ที่ส่งไป
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
    // หอที่สองของเจ้าของหอคนเดียวกัน มีแค่โครงสร้างพื้นฐานกับห้องเดียว พอให้แยกออกว่าไม่ใช่หอแรก
    // ชื่อขึ้นต้นด้วย ฮ จึงเรียงหลังหอแรกเสมอ หน้า /admin ที่พาไปหอแรกสุดตามตัวอักษรจึงไม่เปลี่ยนปลายทาง
    await client.query(
      `INSERT INTO "Property" ("id","name","shortName","isActive","createdAt","updatedAt")
       VALUES ($1,'หอ E2E ฮาเฮ','E2E ฮาเฮ',true,NOW(),NOW())`,
      [e2e.secondPropertyId],
    );
    await client.query(`INSERT INTO "PropertyMembership" ("userId","propertyId","createdAt") VALUES ($1,$2,NOW())`, [e2e.ownerId, e2e.secondPropertyId]);
    await client.query(
      `INSERT INTO "PropertySubscription" ("propertyId","planId","planName","billingInterval","priceAmount","status","maxProperties","maxRooms","startsAt","expiresAt","createdAt","updatedAt")
       VALUES ($1,$2,'E2E Standard','MONTHLY',990,'ACTIVE',2,100,'2026-01-01','2030-01-01',NOW(),NOW())`,
      [e2e.secondPropertyId, plan.rows[0].id],
    );
    await client.query(
      `INSERT INTO "PropertySettings" ("propertyId","address","contactPhone","contactEmail","promptPayId","waterUnitRate","electricityUnitRate","billingDay","dueDay","lateFeePerDay","lateFeeCap","invoicePrefix","houseRules","emergencyContact","createdAt","updatedAt")
       VALUES ($1,'88 ถนนทดสอบสอง กรุงเทพมหานคร','0800000002',$2,'0812345679',18,7,1,5,20,200,'E2E2','ห้ามส่งเสียงดังหลัง 22:00 น.','0800000003',NOW(),NOW())`,
      [e2e.secondPropertyId, e2e.ownerEmail],
    );
    await client.query(`INSERT INTO "Building" ("id","propertyId","name","code","isActive","createdAt","updatedAt") VALUES ($1,$2,'อาคาร E2E สอง','E2E-B',true,NOW(),NOW())`, [secondBuildingId, e2e.secondPropertyId]);
    await client.query(`INSERT INTO "Floor" ("id","propertyId","buildingId","number","label","createdAt","updatedAt") VALUES ($1,$2,$3,1,'ชั้นทดสอบสอง',NOW(),NOW())`, [secondFloorId, e2e.secondPropertyId, secondBuildingId]);
    // เลขห้องต้องไม่ซ้ำกับหอแรก เทสต์จะได้ดูออกว่าหน้าจอกำลังแสดงข้อมูลของหอไหน
    await client.query(
      `INSERT INTO "Room" ("id","propertyId","buildingId","floorId","number","roomType","monthlyRent","depositAmount","capacity","status","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,'F201','Standard',4200,8400,2,'AVAILABLE',NOW(),NOW())`,
      [e2e.secondPropertyRoomId, e2e.secondPropertyId, secondBuildingId, secondFloorId],
    );

    await client.query(`INSERT INTO "Building" ("id","propertyId","name","code","isActive","createdAt","updatedAt") VALUES ($1,$2,'อาคาร E2E','E2E-A',true,NOW(),NOW())`, [buildingId, e2e.propertyId]);
    await client.query(`INSERT INTO "Floor" ("id","propertyId","buildingId","number","label","createdAt","updatedAt") VALUES ($1,$2,$3,1,'ชั้นทดสอบ',NOW(),NOW())`, [floorId, e2e.propertyId, buildingId]);
    // สองห้อง ห้องหนึ่งมีคนอยู่แล้ว อีกห้องว่าง ไว้ทดสอบทั้งสองสถานการณ์
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
    // การเข้าพักสองแบบ อันหนึ่งอนุมัติแล้ว อีกอันยังรออนุมัติ ไว้ทดสอบหน้าคิวอนุมัติ
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
    // บิลหนึ่งใบสถานะรอชำระ พร้อมรายการย่อยค่าห้อง ค่าน้ำ ค่าไฟ ให้ครบเหมือนของจริง
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
    // พลาดตรงไหนก็ย้อนคืนทั้งหมด แล้วโยนต่อให้ Playwright หยุดก่อนเริ่มเทสต์
    await client.query("ROLLBACK");
    throw error;
  } finally {
    // คืนการเชื่อมต่อและปิด pool ทุกกรณี ไม่งั้นโปรเซสจะค้างไม่ยอมจบ
    client.release();
    await pool.end();
  }
}
